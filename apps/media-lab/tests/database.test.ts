import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { openDatabase } from '../src/main/storage/database';
import { mediaLabMigrations } from '../src/main/storage/migrations';
import { upsertMediaAsset } from '../src/main/storage/asset-repository';
import {
  applyConfirmedEditProposal,
  confirmPendingEditProposal,
  createProjectWithStoryboard,
  discardPendingEditProposal,
  getProjectWithStoryboard,
  pruneExpiredEditProposals,
  restoreStoryboardVersion,
  storePendingEditProposal
} from '../src/main/storage/project-repository';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe('SQLite migrations', () => {
  it('creates an append-only location table for multiple observed paths of one asset', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'vp-media-lab-'));
    temporaryDirectories.push(directory);
    const database = await openDatabase({ filePath: join(directory, 'media-lab.sqlite'), migrations: mediaLabMigrations });

    expect(database.appliedMigrationIds()).toEqual([
      '001_core', '002_asset_locations', '003_projects', '004_storyboard_versions',
      '004b_global_proposal_ids', '005_pending_edit_proposals', '006_discarded_edit_proposals',
      '007_ai_usage_events', '008_guided_production', '009_guided_production_integrity', '010_guided_production_current_run', '011_local_jobs_v2'
    ]);
    expect(database.all('SELECT path, asset_id FROM asset_locations;')).toEqual([]);
    await database.close();
  });

  it('deduplicates an owned asset by content hash while retaining both observed paths', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'vp-media-lab-'));
    temporaryDirectories.push(directory);
    const database = await openDatabase({ filePath: join(directory, 'media-lab.sqlite'), migrations: mediaLabMigrations });
    const first = upsertMediaAsset(database, {
      id: 'asset-1', assetKind: 'owned', name: 'arrival.mp4', path: 'C:\\footage\\arrival.mp4', contentHash: 'same-hash', now: '2026-08-11T00:00:00.000Z'
    });
    const duplicate = upsertMediaAsset(database, {
      id: 'asset-2', assetKind: 'owned', name: 'arrival-copy.mp4', path: 'D:\\archive\\arrival-copy.mp4', contentHash: 'same-hash', now: '2026-08-11T00:01:00.000Z'
    });

    expect(duplicate.id).toBe(first.id);
    expect(database.all('SELECT id FROM media_assets WHERE asset_kind = ?;', ['owned'])).toHaveLength(1);
    expect(database.all('SELECT path FROM asset_locations WHERE asset_id = ? ORDER BY path;', ['asset-1']).map((row) => row.path)).toEqual([
      'C:\\footage\\arrival.mp4', 'D:\\archive\\arrival-copy.mp4'
    ]);
    await database.close();
  });

  it('persists a draft project and its versioned storyboard as one local editing unit', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'vp-media-lab-'));
    temporaryDirectories.push(directory);
    const database = await openDatabase({ filePath: join(directory, 'media-lab.sqlite'), migrations: mediaLabMigrations });
    createProjectWithStoryboard(database, {
      id: 'project-1', title: 'Payment before landing', createdAt: '2026-08-11T00:00:00.000Z',
      storyboard: {
        schemaVersion: 1, id: 'storyboard-1', projectId: 'project-1', evidencePackId: null, language: 'en',
        beats: [{ id: 'beat-1', order: 0, durationMs: 5_000, purpose: 'hook', originalScript: '', onScreenText: '', sourceFactIds: [], candidateAssetIds: [], selectedAssetId: null, renderStatus: 'draft' }],
        factualReview: 'not_required', originalityReview: 'required'
      }
    });

    expect(getProjectWithStoryboard(database, 'project-1')).toMatchObject({
      id: 'project-1', title: 'Payment before landing', storyboard: { id: 'storyboard-1', projectId: 'project-1' }
    });
    await database.close();
  });

  it('rolls back a project when its storyboard cannot be inserted', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'vp-media-lab-'));
    temporaryDirectories.push(directory);
    const database = await openDatabase({ filePath: join(directory, 'media-lab.sqlite'), migrations: mediaLabMigrations });
    const storyboard = {
      schemaVersion: 1 as const, id: 'storyboard-shared', projectId: 'project-1', evidencePackId: null, language: 'en' as const,
      beats: [{ id: 'beat-1', order: 0, durationMs: 5_000, purpose: 'hook', originalScript: '', onScreenText: '', sourceFactIds: [], candidateAssetIds: [], selectedAssetId: null, renderStatus: 'draft' as const }],
      factualReview: 'not_required' as const, originalityReview: 'required' as const
    };
    createProjectWithStoryboard(database, {
      id: 'project-1', title: 'First project', createdAt: '2026-08-11T00:00:00.000Z', storyboard
    });

    expect(() => createProjectWithStoryboard(database, {
      id: 'project-2', title: 'Second project', createdAt: '2026-08-11T00:01:00.000Z',
      storyboard: { ...storyboard, projectId: 'project-2' }
    })).toThrow();
    expect(database.all('SELECT id FROM projects WHERE id = ?;', ['project-2'])).toEqual([]);
    await database.close();
  });

  it('applies a confirmed edit atomically while retaining the previous storyboard version', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'vp-media-lab-'));
    temporaryDirectories.push(directory);
    const database = await openDatabase({ filePath: join(directory, 'media-lab.sqlite'), migrations: mediaLabMigrations });
    createProjectWithStoryboard(database, {
      id: 'project-1', title: 'Arrival checklist', createdAt: '2026-08-11T00:00:00.000Z',
      storyboard: {
        schemaVersion: 1, id: 'storyboard-1', projectId: 'project-1', evidencePackId: null, language: 'en',
        beats: [{ id: 'beat-1', order: 0, durationMs: 5_000, purpose: 'hook', originalScript: '', onScreenText: 'Before landing', sourceFactIds: [], candidateAssetIds: [], selectedAssetId: null, renderStatus: 'draft' }],
        factualReview: 'not_required', originalityReview: 'required'
      }
    });

    const result = applyConfirmedEditProposal(database, {
      proposal: {
        schemaVersion: 1, id: 'proposal-1', projectId: 'project-1', summary: 'Clarify the caption.',
        operations: [{ type: 'update_caption', beatId: 'beat-1', onScreenText: 'Set up Alipay before landing' }]
      },
      assetRights: {}, today: '2026-08-11', appliedAt: '2026-08-11T00:01:00.000Z'
    });

    expect(result.revision).toBe(1);
    expect(result.project.storyboard.beats[0].onScreenText).toBe('Set up Alipay before landing');
    const versions = database.all('SELECT revision, proposal_id, payload FROM storyboard_versions WHERE project_id = ? ORDER BY revision;', ['project-1']);
    expect(versions.map((row) => [row.revision, row.proposal_id])).toEqual([[0, null], [1, 'proposal-1']]);
    expect(JSON.parse(String(versions[0].payload)).beats[0].onScreenText).toBe('Before landing');
    await database.close();
  });

  it('confirms the exact main-owned proposal only at its source storyboard revision', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'vp-media-lab-'));
    temporaryDirectories.push(directory);
    const database = await openDatabase({ filePath: join(directory, 'media-lab.sqlite'), migrations: mediaLabMigrations });
    createProjectWithStoryboard(database, {
      id: 'project-1', title: 'Arrival checklist', createdAt: '2026-08-11T00:00:00.000Z',
      storyboard: {
        schemaVersion: 1, id: 'storyboard-1', projectId: 'project-1', evidencePackId: null, language: 'en',
        beats: [{ id: 'beat-1', order: 0, durationMs: 5_000, purpose: 'hook', originalScript: '', onScreenText: 'Before landing', sourceFactIds: [], candidateAssetIds: [], selectedAssetId: null, renderStatus: 'draft' }],
        factualReview: 'not_required', originalityReview: 'required'
      }
    });
    const pending = storePendingEditProposal(database, {
      proposal: {
        schemaVersion: 1, id: 'proposal-pending', projectId: 'project-1', summary: 'Clarify the caption.',
        operations: [{ type: 'update_caption', beatId: 'beat-1', onScreenText: 'Set up Alipay before landing' }]
      },
      expectedRevision: 0,
      storedAt: '2026-08-11T00:00:30.000Z'
    });

    expect(pending.baseRevision).toBe(0);
    const result = confirmPendingEditProposal(database, {
      projectId: 'project-1', proposalId: 'proposal-pending', expectedRevision: 0,
      assetRights: {}, today: '2026-08-11', appliedAt: '2026-08-11T00:01:00.000Z'
    });
    expect(result.project.storyboard.beats[0].onScreenText).toBe('Set up Alipay before landing');
    expect(database.all('SELECT status FROM pending_edit_proposals WHERE proposal_id = ?;', ['proposal-pending']))
      .toEqual([{ status: 'confirmed' }]);
    expect(() => confirmPendingEditProposal(database, {
      projectId: 'project-1', proposalId: 'proposal-pending', expectedRevision: 0,
      assetRights: {}, today: '2026-08-11', appliedAt: '2026-08-11T00:02:00.000Z'
    })).toThrow('PENDING_PROPOSAL_NOT_FOUND');
    await database.close();
  });

  it('rejects a pending proposal after the storyboard head has changed', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'vp-media-lab-'));
    temporaryDirectories.push(directory);
    const database = await openDatabase({ filePath: join(directory, 'media-lab.sqlite'), migrations: mediaLabMigrations });
    createProjectWithStoryboard(database, {
      id: 'project-1', title: 'Arrival checklist', createdAt: '2026-08-11T00:00:00.000Z',
      storyboard: {
        schemaVersion: 1, id: 'storyboard-1', projectId: 'project-1', evidencePackId: null, language: 'en',
        beats: [{ id: 'beat-1', order: 0, durationMs: 5_000, purpose: 'hook', originalScript: '', onScreenText: 'Before landing', sourceFactIds: [], candidateAssetIds: [], selectedAssetId: null, renderStatus: 'draft' }],
        factualReview: 'not_required', originalityReview: 'required'
      }
    });
    storePendingEditProposal(database, {
      proposal: { schemaVersion: 1, id: 'proposal-stale', projectId: 'project-1', summary: 'First idea.', operations: [{ type: 'update_caption', beatId: 'beat-1', onScreenText: 'Stale caption' }] },
      expectedRevision: 0,
      storedAt: '2026-08-11T00:00:30.000Z'
    });
    applyConfirmedEditProposal(database, {
      proposal: { schemaVersion: 1, id: 'proposal-new-head', projectId: 'project-1', summary: 'Accepted idea.', operations: [{ type: 'update_caption', beatId: 'beat-1', onScreenText: 'Accepted caption' }] },
      assetRights: {}, today: '2026-08-11', appliedAt: '2026-08-11T00:01:00.000Z'
    });

    expect(() => storePendingEditProposal(database, {
      proposal: { schemaVersion: 1, id: 'proposal-finished-late', projectId: 'project-1', summary: 'Late AI result.', operations: [{ type: 'update_caption', beatId: 'beat-1', onScreenText: 'Late caption' }] },
      expectedRevision: 0,
      storedAt: '2026-08-11T00:01:30.000Z'
    })).toThrow('STALE_PROPOSAL');

    expect(() => confirmPendingEditProposal(database, {
      projectId: 'project-1', proposalId: 'proposal-stale', expectedRevision: 0,
      assetRights: {}, today: '2026-08-11', appliedAt: '2026-08-11T00:02:00.000Z'
    })).toThrow('STALE_PROPOSAL');
    expect(getProjectWithStoryboard(database, 'project-1')?.storyboard.beats[0].onScreenText).toBe('Accepted caption');
    await database.close();
  });

  it('invalidates discarded proposals and prunes old settled records', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'vp-media-lab-'));
    temporaryDirectories.push(directory);
    const database = await openDatabase({ filePath: join(directory, 'media-lab.sqlite'), migrations: mediaLabMigrations });
    createProjectWithStoryboard(database, {
      id: 'project-1', title: 'Arrival checklist', createdAt: '2026-06-01T00:00:00.000Z',
      storyboard: {
        schemaVersion: 1, id: 'storyboard-1', projectId: 'project-1', evidencePackId: null, language: 'en',
        beats: [{ id: 'beat-1', order: 0, durationMs: 5_000, purpose: 'hook', originalScript: '', onScreenText: 'Before landing', sourceFactIds: [], candidateAssetIds: [], selectedAssetId: null, renderStatus: 'draft' }],
        factualReview: 'not_required', originalityReview: 'required'
      }
    });
    storePendingEditProposal(database, {
      proposal: { schemaVersion: 1, id: 'proposal-discard', projectId: 'project-1', summary: 'Discard this.', operations: [{ type: 'update_caption', beatId: 'beat-1', onScreenText: 'Not accepted' }] },
      expectedRevision: 0,
      storedAt: '2026-06-01T00:01:00.000Z'
    });
    storePendingEditProposal(database, {
      proposal: { schemaVersion: 1, id: 'proposal-abandoned', projectId: 'project-1', summary: 'Abandoned pending idea.', operations: [{ type: 'update_caption', beatId: 'beat-1', onScreenText: 'Also not accepted' }] },
      expectedRevision: 0,
      storedAt: '2026-06-01T00:01:30.000Z'
    });

    discardPendingEditProposal(database, {
      projectId: 'project-1', proposalId: 'proposal-discard', expectedRevision: 0,
      discardedAt: '2026-06-01T00:02:00.000Z'
    });
    expect(() => confirmPendingEditProposal(database, {
      projectId: 'project-1', proposalId: 'proposal-discard', expectedRevision: 0,
      assetRights: {}, today: '2026-08-11', appliedAt: '2026-08-11T00:00:00.000Z'
    })).toThrow('PENDING_PROPOSAL_NOT_FOUND');
    expect(database.all('SELECT status FROM pending_edit_proposals WHERE proposal_id = ?;', ['proposal-discard']))
      .toEqual([{ status: 'discarded' }]);
    expect(pruneExpiredEditProposals(database, '2026-07-01T00:00:00.000Z')).toBe(2);
    expect(database.all('SELECT proposal_id FROM pending_edit_proposals;')).toEqual([]);
    await database.close();
  });

  it('treats a proposal ID as globally idempotent across projects', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'vp-media-lab-'));
    temporaryDirectories.push(directory);
    const database = await openDatabase({ filePath: join(directory, 'media-lab.sqlite'), migrations: mediaLabMigrations });
    const create = (projectId: string) => createProjectWithStoryboard(database, {
      id: projectId, title: projectId, createdAt: '2026-08-11T00:00:00.000Z',
      storyboard: {
        schemaVersion: 1 as const, id: `storyboard-${projectId}`, projectId, evidencePackId: null, language: 'en' as const,
        beats: [{ id: `beat-${projectId}`, order: 0, durationMs: 5_000, purpose: 'hook', originalScript: '', onScreenText: '', sourceFactIds: [], candidateAssetIds: [], selectedAssetId: null, renderStatus: 'draft' as const }],
        factualReview: 'not_required' as const, originalityReview: 'required' as const
      }
    });
    create('project-1');
    create('project-2');
    const apply = (projectId: string) => applyConfirmedEditProposal(database, {
      proposal: { schemaVersion: 1, id: 'proposal-global', projectId, summary: 'Set caption.', operations: [{ type: 'update_caption', beatId: `beat-${projectId}`, onScreenText: projectId }] },
      assetRights: {}, today: '2026-08-11', appliedAt: '2026-08-11T00:01:00.000Z'
    });

    expect(apply('project-1').revision).toBe(1);
    expect(() => apply('project-2')).toThrow('PROPOSAL_ALREADY_APPLIED');
    await database.close();
  });

  it('rolls back a caught nested transaction with a savepoint', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'vp-media-lab-'));
    temporaryDirectories.push(directory);
    const database = await openDatabase({ filePath: join(directory, 'media-lab.sqlite'), migrations: mediaLabMigrations });
    database.transaction(() => {
      database.setSetting('outer', 'kept');
      try {
        database.transaction(() => {
          database.setSetting('inner', 'rolled-back');
          throw new Error('EXPECTED_INNER_FAILURE');
        });
      } catch (error) {
        expect((error as Error).message).toBe('EXPECTED_INNER_FAILURE');
      }
    });
    expect(database.getSetting('outer')).toBe('kept');
    expect(database.getSetting('inner')).toBeNull();
    await database.close();
  });

  it('does not apply one proposal twice and keeps the accepted revision after restart', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'vp-media-lab-'));
    temporaryDirectories.push(directory);
    const filePath = join(directory, 'media-lab.sqlite');
    const database = await openDatabase({ filePath, migrations: mediaLabMigrations });
    createProjectWithStoryboard(database, {
      id: 'project-1', title: 'Arrival checklist', createdAt: '2026-08-11T00:00:00.000Z',
      storyboard: {
        schemaVersion: 1, id: 'storyboard-1', projectId: 'project-1', evidencePackId: null, language: 'en',
        beats: [{ id: 'beat-1', order: 0, durationMs: 5_000, purpose: 'hook', originalScript: '', onScreenText: 'Before landing', sourceFactIds: [], candidateAssetIds: [], selectedAssetId: null, renderStatus: 'draft' }],
        factualReview: 'not_required', originalityReview: 'required'
      }
    });
    const input = {
      proposal: {
        schemaVersion: 1 as const, id: 'proposal-once', projectId: 'project-1', summary: 'Clarify the caption.',
        operations: [{ type: 'update_caption' as const, beatId: 'beat-1', onScreenText: 'Set up Alipay before landing' }]
      },
      assetRights: {}, today: '2026-08-11', appliedAt: '2026-08-11T00:01:00.000Z'
    };

    expect(applyConfirmedEditProposal(database, input).revision).toBe(1);
    expect(() => applyConfirmedEditProposal(database, input)).toThrow('PROPOSAL_ALREADY_APPLIED');
    await database.close();

    const reopened = await openDatabase({ filePath, migrations: mediaLabMigrations });
    expect(getProjectWithStoryboard(reopened, 'project-1')?.storyboard.beats[0].onScreenText)
      .toBe('Set up Alipay before landing');
    await reopened.close();
  });

  it('restores an old storyboard as a new head without deleting newer history', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'vp-media-lab-'));
    temporaryDirectories.push(directory);
    const database = await openDatabase({ filePath: join(directory, 'media-lab.sqlite'), migrations: mediaLabMigrations });
    createProjectWithStoryboard(database, {
      id: 'project-1', title: 'Arrival checklist', createdAt: '2026-08-11T00:00:00.000Z',
      storyboard: {
        schemaVersion: 1, id: 'storyboard-1', projectId: 'project-1', evidencePackId: null, language: 'en',
        beats: [{ id: 'beat-1', order: 0, durationMs: 5_000, purpose: 'hook', originalScript: '', onScreenText: 'Before landing', sourceFactIds: [], candidateAssetIds: [], selectedAssetId: null, renderStatus: 'draft' }],
        factualReview: 'not_required', originalityReview: 'required'
      }
    });
    applyConfirmedEditProposal(database, {
      proposal: {
        schemaVersion: 1, id: 'proposal-1', projectId: 'project-1', summary: 'Clarify the caption.',
        operations: [{ type: 'update_caption', beatId: 'beat-1', onScreenText: 'Set up Alipay before landing' }]
      },
      assetRights: {}, today: '2026-08-11', appliedAt: '2026-08-11T00:01:00.000Z'
    });

    const restored = restoreStoryboardVersion(database, {
      projectId: 'project-1', revision: 0, restoreId: 'restore-1', restoredAt: '2026-08-11T00:02:00.000Z'
    });

    expect(restored.revision).toBe(2);
    expect(restored.project.storyboard.beats[0].onScreenText).toBe('Before landing');
    expect(database.all(
      'SELECT revision, proposal_id FROM storyboard_versions WHERE project_id = ? ORDER BY revision;', ['project-1']
    )).toMatchObject([
      { revision: 0, proposal_id: null },
      { revision: 1, proposal_id: 'proposal-1' },
      { revision: 2, proposal_id: 'restore:restore-1' }
    ]);
    await database.close();
  });

  it('applies each migration once and persists records across restart', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'vp-media-lab-'));
    temporaryDirectories.push(directory);
    const filePath = join(directory, 'media-lab.sqlite');
    const migrations = [{ id: '001_core', sql: 'CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);' }];

    const first = await openDatabase({ filePath, migrations });
    first.setSetting('library_mode', 'index');
    expect(first.appliedMigrationIds()).toEqual(['001_core']);
    await first.close();

    const reopened = await openDatabase({ filePath, migrations });
    expect(reopened.appliedMigrationIds()).toEqual(['001_core']);
    expect(reopened.getSetting('library_mode')).toBe('index');
    await reopened.close();
  });

  it('upgrades a populated migration-003 database without losing its project', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'vp-media-lab-'));
    temporaryDirectories.push(directory);
    const filePath = join(directory, 'media-lab.sqlite');
    const legacy = await openDatabase({ filePath, migrations: mediaLabMigrations.slice(0, 3) });
    createProjectWithStoryboard(legacy, {
      id: 'legacy-project', title: 'Legacy draft', createdAt: '2026-08-10T00:00:00.000Z',
      storyboard: {
        schemaVersion: 1, id: 'legacy-storyboard', projectId: 'legacy-project', evidencePackId: null, language: 'en',
        beats: [{ id: 'legacy-beat', order: 0, durationMs: 5_000, purpose: 'hook', originalScript: '', onScreenText: 'Legacy caption', sourceFactIds: [], candidateAssetIds: [], selectedAssetId: null, renderStatus: 'draft' }],
        factualReview: 'not_required', originalityReview: 'required'
      }
    });
    legacy.close();

    const upgraded = await openDatabase({ filePath, migrations: mediaLabMigrations });
    expect(getProjectWithStoryboard(upgraded, 'legacy-project')).toMatchObject({
      revision: 0,
      storyboard: { beats: [{ onScreenText: 'Legacy caption' }] }
    });
    expect(upgraded.all("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'pending_edit_proposals';"))
      .toEqual([{ name: 'pending_edit_proposals' }]);
    upgraded.close();
  });

  it('reconciles duplicate proposal IDs before upgrading a populated migration-004 database', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'vp-media-lab-'));
    temporaryDirectories.push(directory);
    const filePath = join(directory, 'media-lab.sqlite');
    const legacy = await openDatabase({ filePath, migrations: mediaLabMigrations.slice(0, 4) });
    for (const projectId of ['project-1', 'project-2']) {
      createProjectWithStoryboard(legacy, {
        id: projectId, title: projectId, createdAt: '2026-08-10T00:00:00.000Z',
        storyboard: {
          schemaVersion: 1, id: `storyboard-${projectId}`, projectId, evidencePackId: null, language: 'en',
          beats: [{ id: `beat-${projectId}`, order: 0, durationMs: 5_000, purpose: 'hook', originalScript: '', onScreenText: projectId, sourceFactIds: [], candidateAssetIds: [], selectedAssetId: null, renderStatus: 'draft' }],
          factualReview: 'not_required', originalityReview: 'required'
        }
      });
      const payload = String(legacy.all('SELECT payload FROM storyboards WHERE project_id = ?;', [projectId])[0].payload);
      legacy.run(
        `INSERT INTO storyboard_versions
          (project_id, revision, proposal_id, schema_version, payload, created_at)
         VALUES (?, 1, 'legacy-duplicate', 1, ?, '2026-08-10T00:01:00.000Z');`,
        [projectId, payload]
      );
    }
    legacy.close();

    const upgraded = await openDatabase({ filePath, migrations: mediaLabMigrations });
    expect(upgraded.all(
      `SELECT project_id, proposal_id, legacy_proposal_id FROM storyboard_versions
       WHERE revision = 1 ORDER BY project_id;`
    )).toEqual([
      { project_id: 'project-1', proposal_id: 'legacy-duplicate', legacy_proposal_id: null },
      { project_id: 'project-2', proposal_id: null, legacy_proposal_id: 'legacy-duplicate' }
    ]);
    upgraded.close();
  });

  it('rejects a migration whose accepted SQL checksum changes', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'vp-media-lab-'));
    temporaryDirectories.push(directory);
    const filePath = join(directory, 'media-lab.sqlite');
    const first = await openDatabase({ filePath, migrations: [{ id: '001_core', sql: 'CREATE TABLE sample (id TEXT);' }] });
    await first.close();

    await expect(
      openDatabase({ filePath, migrations: [{ id: '001_core', sql: 'CREATE TABLE sample (id TEXT, changed TEXT);' }] })
    ).rejects.toThrow('Migration checksum changed');
  });
});
