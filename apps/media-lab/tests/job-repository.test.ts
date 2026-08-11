import { afterEach, describe, expect, it } from 'vitest';
import { transitionJob } from '@visepanda/media-lab-domain';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { openDatabase } from '../src/main/storage/database';
import { mediaLabMigrations } from '../src/main/storage/migrations';
import { claimNextLocalJob, enqueueLocalJob, reconcileInterruptedJobs, requestCancelLocalJob } from '../src/main/storage/job-repository';

const directories: string[] = [];
afterEach(async () => { await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))); });

describe('recoverable local jobs', () => {
  it('returns interrupted work to the queue and honors cancellation', () => {
    const recovered = transitionJob({ id: 'job-1', state: 'running', attempt: 1, maxAttempts: 3 }, { type: 'recover' }, '2026-08-11T00:00:00.000Z');
    expect(recovered.state).toBe('queued');
    const canceled = transitionJob({ ...recovered, state: 'cancel_requested' }, { type: 'cancel' }, '2026-08-11T00:00:00.000Z');
    expect(canceled.state).toBe('canceled');
  });

  it('deduplicates, atomically claims, cancels, and reconciles persisted jobs', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'vp-media-lab-job-'));
    directories.push(directory);
    const database = await openDatabase({ filePath: join(directory, 'media-lab.sqlite'), migrations: mediaLabMigrations });
    const first = enqueueLocalJob(database, { id: 'job-1', kind: 'index', payload: '{}', dedupeKey: 'asset-1', createdAt: '2026-08-11T00:00:00.000Z' });
    expect(enqueueLocalJob(database, { id: 'job-2', kind: 'index', payload: '{}', dedupeKey: 'asset-1', createdAt: '2026-08-11T00:00:01.000Z' }).id).toBe(first.id);
    expect(claimNextLocalJob(database, '2026-08-11T00:00:02.000Z')?.state).toBe('running');
    expect(requestCancelLocalJob(database, first.id)).toBe(true);
    expect(reconcileInterruptedJobs(database, '2026-08-11T00:00:03.000Z')).toBe(1);
    expect(database.all('SELECT state, cancel_requested, finished_at FROM local_jobs WHERE id = ?;', [first.id])[0])
      .toMatchObject({ state: 'canceled', cancel_requested: 1, finished_at: '2026-08-11T00:00:03.000Z' });
    await database.close();
  });

  it('finishes an interrupted cancellation instead of leaving it in an unclaimable queue state', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'vp-media-lab-job-'));
    directories.push(directory);
    const database = await openDatabase({ filePath: join(directory, 'media-lab.sqlite'), migrations: mediaLabMigrations });
    enqueueLocalJob(database, { id: 'job-cancel', kind: 'index', payload: '{}', createdAt: '2026-08-11T00:00:00.000Z' });
    expect(claimNextLocalJob(database, '2026-08-11T00:00:01.000Z')?.state).toBe('running');
    expect(requestCancelLocalJob(database, 'job-cancel')).toBe(true);

    reconcileInterruptedJobs(database, '2026-08-11T00:00:02.000Z');

    try {
      expect(database.all('SELECT state, cancel_requested, finished_at FROM local_jobs WHERE id = ?;', ['job-cancel'])[0])
        .toMatchObject({ state: 'canceled', cancel_requested: 1, finished_at: '2026-08-11T00:00:02.000Z' });
    } finally {
      await database.close();
    }
  });
});
