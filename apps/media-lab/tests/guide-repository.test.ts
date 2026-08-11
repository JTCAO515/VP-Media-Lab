import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { openDatabase } from '../src/main/storage/database';
import { mediaLabMigrations } from '../src/main/storage/migrations';
import { createProjectWithStoryboard } from '../src/main/storage/project-repository';
import { createGuideRun, getGuideRun, transitionStoredGuideRun } from '../src/main/storage/guide-repository';
import { guideTemplateFixture as template } from './fixtures/guide';

const directories: string[] = [];
const NOW = '2026-08-11T00:00:00.000Z';

afterEach(async () => { await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))); });

async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), 'vp-media-lab-guide-'));
  directories.push(directory);
  const database = await openDatabase({ filePath: join(directory, 'media-lab.sqlite'), migrations: mediaLabMigrations });
  createProjectWithStoryboard(database, {
    id: 'project-1', title: '支付准备', createdAt: NOW,
    storyboard: { schemaVersion: 1, id: 'storyboard-1', projectId: 'project-1', evidencePackId: null, language: 'zh', beats: [{ id: 'beat-1', order: 0, durationMs: 5000, purpose: '开场', originalScript: '', onScreenText: '', sourceFactIds: [], candidateAssetIds: [], selectedAssetId: null, renderStatus: 'draft' }], factualReview: 'not_required', originalityReview: 'required' }
  });
  return database;
}

describe('guide repository', () => {
  it('creates a fresh, unconfirmed guide for each project', async () => {
    const database = await fixture();
    createProjectWithStoryboard(database, {
      id: 'project-2', title: '网络准备', createdAt: NOW,
      storyboard: { schemaVersion: 1, id: 'storyboard-2', projectId: 'project-2', evidencePackId: null, language: 'zh', beats: [{ id: 'beat-2', order: 0, durationMs: 5000, purpose: '开场', originalScript: '', onScreenText: '', sourceFactIds: [], candidateAssetIds: [], selectedAssetId: null, renderStatus: 'draft' }], factualReview: 'not_required', originalityReview: 'required' }
    });
    const first = createGuideRun(database, { id: 'run-1', projectId: 'project-1', template, createdAt: NOW });
    const second = createGuideRun(database, { id: 'run-2', projectId: 'project-2', template, createdAt: NOW });
    expect(second.id).not.toBe(first.id);
    expect(second.steps.every((step) => step.confirmedAt === null && step.blockedReason === null && step.skippedReason === null)).toBe(true);
    await database.close();
  });

  it('rejects a different template payload for an existing template version and a second run for one project', async () => {
    const database = await fixture();
    createGuideRun(database, { id: 'run-1', projectId: 'project-1', template, createdAt: NOW });
    expect(() => createGuideRun(database, { id: 'run-2', projectId: 'project-1', template, createdAt: NOW })).toThrow('GUIDE_RUN_ALREADY_EXISTS');
    createProjectWithStoryboard(database, {
      id: 'project-2', title: '网络准备', createdAt: NOW,
      storyboard: { schemaVersion: 1, id: 'storyboard-2', projectId: 'project-2', evidencePackId: null, language: 'zh', beats: [{ id: 'beat-2', order: 0, durationMs: 5000, purpose: '开场', originalScript: '', onScreenText: '', sourceFactIds: [], candidateAssetIds: [], selectedAssetId: null, renderStatus: 'draft' }], factualReview: 'not_required', originalityReview: 'required' }
    });
    expect(() => createGuideRun(database, {
      id: 'run-3', projectId: 'project-2', createdAt: NOW,
      template: { ...template, title: '内容已被改变' }
    })).toThrow('GUIDE_TEMPLATE_VERSION_CONFLICT');
    await database.close();
  });

  it('snapshots project-specific template values before persisting a run', async () => {
    const database = await fixture();
    createProjectWithStoryboard(database, {
      id: 'project-2', title: '网络准备', createdAt: NOW,
      storyboard: { schemaVersion: 1, id: 'storyboard-2', projectId: 'project-2', evidencePackId: null, language: 'zh', beats: [{ id: 'beat-2', order: 0, durationMs: 5000, purpose: '开场', originalScript: '', onScreenText: '', sourceFactIds: [], candidateAssetIds: [], selectedAssetId: null, renderStatus: 'draft' }], factualReview: 'not_required', originalityReview: 'required' }
    });
    const projectTemplate = { ...template, steps: [{ ...template.steps[0]!, instruction: '确认{{topic}}主题。' }, ...template.steps.slice(1)] };
    const run = createGuideRun(database, {
      id: 'run-1', projectId: 'project-1', createdAt: NOW,
      projectFacts: { topic: '落地支付' },
      template: projectTemplate
    });
    const second = createGuideRun(database, {
      id: 'run-2', projectId: 'project-2', createdAt: NOW,
      projectFacts: { topic: '移动网络' }, template: projectTemplate
    });
    expect(run.steps[0]?.instruction).toBe('确认落地支付主题。');
    expect(second.steps[0]?.instruction).toBe('确认移动网络主题。');
    await database.close();
  });

  it('allows controlled run deletion to cascade while retaining append-only updates', async () => {
    const database = await fixture();
    const run = createGuideRun(database, { id: 'run-1', projectId: 'project-1', template, createdAt: NOW });
    transitionStoredGuideRun(database, { runId: run.id, event: { type: 'evidence_passed', stepId: 'brief', at: NOW } });
    expect(() => database.run('DELETE FROM guided_production_runs WHERE id = ?;', [run.id])).not.toThrow();
    expect(database.all('SELECT * FROM guided_production_events WHERE run_id = ?;', [run.id])).toEqual([]);
    await database.close();
  });

  it('creates independent runs and persists the exact active step across restart', async () => {
    const database = await fixture();
    const first = createGuideRun(database, { id: 'run-1', projectId: 'project-1', template, createdAt: NOW });
    expect(first.steps.map((step) => step.state)).toEqual(['active', 'pending', 'pending']);
    const advanced = transitionStoredGuideRun(database, { runId: first.id, event: { type: 'evidence_passed', stepId: 'brief', at: NOW } });
    transitionStoredGuideRun(database, { runId: advanced.id, event: { type: 'confirm', stepId: 'brief', at: NOW } });
    expect(getGuideRun(database, first.id)?.steps.map((step) => step.state)).toEqual(['completed', 'active', 'pending']);
    expect(() => database.run(
      "UPDATE guided_production_events SET event_type = 'tampered' WHERE run_id = ? AND sequence = 1;",
      [first.id]
    )).toThrow('GUIDE_EVENTS_APPEND_ONLY');
    await database.close();

    const reopened = await openDatabase({ filePath: join(directories[0]!, 'media-lab.sqlite'), migrations: mediaLabMigrations });
    expect(getGuideRun(reopened, 'run-1')?.steps[1]?.state).toBe('active');
    expect(reopened.all('SELECT event_type FROM guided_production_events ORDER BY sequence;').map((row) => row.event_type)).toEqual(['evidence_passed', 'confirm']);
    await reopened.close();
  });
});
