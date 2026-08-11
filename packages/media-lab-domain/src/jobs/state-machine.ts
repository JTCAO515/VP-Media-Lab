export type LocalJobState =
  | 'queued'
  | 'running'
  | 'retry_wait'
  | 'cancel_requested'
  | 'succeeded'
  | 'failed'
  | 'canceled';

export interface LocalJob {
  id: string;
  state: LocalJobState;
  attempt: number;
  maxAttempts: number;
  startedAt?: string;
  finishedAt?: string;
}

export type LocalJobEvent = { type: 'start' };

export function transitionJob(job: LocalJob, event: LocalJobEvent, now: string): LocalJob {
  if (event.type === 'start' && job.state === 'queued') {
    return { ...job, state: 'running', startedAt: now };
  }

  throw new Error(`Invalid job transition: ${job.state} -> ${event.type}`);
}
