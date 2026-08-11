import { describe, expect, it } from 'vitest';
import { transitionJob } from '@visepanda/media-lab-domain';

describe('recoverable local jobs', () => {
  it('returns interrupted work to the queue and honors cancellation', () => {
    const recovered = transitionJob({ id: 'job-1', state: 'running', attempt: 1, maxAttempts: 3 }, { type: 'recover' }, '2026-08-11T00:00:00.000Z');
    expect(recovered.state).toBe('queued');
    const canceled = transitionJob({ ...recovered, state: 'cancel_requested' }, { type: 'cancel' }, '2026-08-11T00:00:00.000Z');
    expect(canceled.state).toBe('canceled');
  });
});
