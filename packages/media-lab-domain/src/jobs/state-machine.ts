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

export type LocalJobEvent =
  | { type: 'start' }
  | { type: 'recover' }
  | { type: 'requestCancel' }
  | { type: 'cancel' }
  | { type: 'retry' };

export function transitionJob(job: LocalJob, event: LocalJobEvent, now: string): LocalJob {
  if (event.type === 'start' && job.state === 'queued') {
    return { ...job, state: 'running', startedAt: now };
  }

  if (event.type === 'recover' && (job.state === 'running' || job.state === 'cancel_requested')) {
    return { ...job, state: 'queued', startedAt: undefined };
  }

  if (event.type === 'requestCancel' && job.state === 'running') {
    return { ...job, state: 'cancel_requested' };
  }

  if (event.type === 'cancel' && job.state === 'cancel_requested') {
    return { ...job, state: 'canceled', finishedAt: now };
  }

  if (event.type === 'retry' && job.state === 'failed' && job.attempt < job.maxAttempts) {
    return { ...job, state: 'queued', attempt: job.attempt + 1, startedAt: undefined, finishedAt: undefined };
  }

  throw new Error(`Invalid job transition: ${job.state} -> ${event.type}`);
}
