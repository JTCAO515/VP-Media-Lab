import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { openDatabase } from '../src/main/storage/database';
import { mediaLabMigrations } from '../src/main/storage/migrations';
import { upsertMediaAsset } from '../src/main/storage/asset-repository';
import { createProjectWithStoryboard, getProjectWithStoryboard } from '../src/main/storage/project-repository';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe('SQLite migrations', () => {
  it('creates an append-only location table for multiple observed paths of one asset', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'vp-media-lab-'));
    temporaryDirectories.push(directory);
    const database = await openDatabase({ filePath: join(directory, 'media-lab.sqlite'), migrations: mediaLabMigrations });

    expect(database.appliedMigrationIds()).toEqual(['001_core', '002_asset_locations', '003_projects']);
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
