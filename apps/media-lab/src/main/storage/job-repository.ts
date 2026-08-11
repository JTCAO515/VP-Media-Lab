import type { MediaLabDatabase } from './database';

export interface StoredLocalJob { id: string; kind: string; state: string; payload: string; progress: number; attempt: number; maxAttempts: number; cancelRequested: boolean; }

function row(value: Record<string, unknown>): StoredLocalJob { return { id: String(value.id), kind: String(value.kind), state: String(value.state), payload: String(value.payload), progress: Number(value.progress), attempt: Number(value.attempt), maxAttempts: Number(value.max_attempts), cancelRequested: Number(value.cancel_requested) === 1 }; }

export function enqueueLocalJob(database: MediaLabDatabase, input: { id: string; kind: string; payload: string; dedupeKey?: string; createdAt: string }): StoredLocalJob {
  return database.transaction(() => { const existing = input.dedupeKey ? database.all('SELECT * FROM local_jobs WHERE dedupe_key = ?;', [input.dedupeKey])[0] : undefined; if (existing) return row(existing); database.run('INSERT INTO local_jobs (id, kind, state, created_at, payload, dedupe_key) VALUES (?, ?, \'queued\', ?, ?, ?);', [input.id, input.kind, input.createdAt, input.payload, input.dedupeKey ?? null]); return row(database.all('SELECT * FROM local_jobs WHERE id = ?;', [input.id])[0]!); });
}

export function reconcileInterruptedJobs(database: MediaLabDatabase, finishedAt: string): number {
  return database.transaction(() => {
    const recovered = database.run("UPDATE local_jobs SET state = 'queued', started_at = NULL WHERE state = 'running';");
    const canceled = database.run("UPDATE local_jobs SET state = 'canceled', finished_at = ? WHERE state = 'cancel_requested';", [finishedAt]);
    return Number(recovered.changes) + Number(canceled.changes);
  });
}

export function claimNextLocalJob(database: MediaLabDatabase, startedAt: string): StoredLocalJob | null {
  return database.transaction(() => {
    const candidate = database.all("SELECT id FROM local_jobs WHERE state = 'queued' AND cancel_requested = 0 ORDER BY created_at, id LIMIT 1;")[0];
    if (!candidate) return null;
    const result = database.run("UPDATE local_jobs SET state = 'running', started_at = ? WHERE id = ? AND state = 'queued' AND cancel_requested = 0;", [startedAt, String(candidate.id)]);
    if (Number(result.changes) !== 1) return null;
    return row(database.all('SELECT * FROM local_jobs WHERE id = ?;', [String(candidate.id)])[0]!);
  });
}

export function requestCancelLocalJob(database: MediaLabDatabase, id: string): boolean { return Number(database.run("UPDATE local_jobs SET state = 'cancel_requested', cancel_requested = 1 WHERE id = ? AND state IN ('queued', 'running');", [id]).changes) === 1; }
