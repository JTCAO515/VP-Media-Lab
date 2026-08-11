import { describe, expect, it } from 'vitest';
import { transitionJob } from '@visepanda/media-lab-domain';

describe('LocalJob state machine', () => {
  it('moves a queued job to running', () => {
    expect(
      transitionJob(
        { id: 'job-1', state: 'queued', attempt: 0, maxAttempts: 3 },
        { type: 'start' },
        '2026-08-11T00:00:00.000Z'
      )
    ).toMatchObject({ state: 'running', startedAt: '2026-08-11T00:00:00.000Z' });
  });

  it('refuses to start a job that has already succeeded', () => {
    expect(() =>
      transitionJob(
        { id: 'job-1', state: 'succeeded', attempt: 1, maxAttempts: 3 },
        { type: 'start' },
        '2026-08-11T00:00:00.000Z'
      )
    ).toThrow('Invalid job transition');
  });

  it('records cancellation before marking a running job canceled', () => {
    const requested = transitionJob(
      { id: 'job-1', state: 'running', attempt: 1, maxAttempts: 3 },
      { type: 'requestCancel' },
      '2026-08-11T00:00:00.000Z'
    );

    expect(requested.state).toBe('cancel_requested');
    expect(
      transitionJob(requested, { type: 'cancel' }, '2026-08-11T00:00:01.000Z')
    ).toMatchObject({ state: 'canceled', finishedAt: '2026-08-11T00:00:01.000Z' });
  });

  it('allows a failed job to be explicitly retried only within its retry bound', () => {
    expect(
      transitionJob(
        { id: 'job-1', state: 'failed', attempt: 1, maxAttempts: 2 },
        { type: 'retry' },
        '2026-08-11T00:00:00.000Z'
      )
    ).toMatchObject({ state: 'queued', attempt: 2 });

    expect(() =>
      transitionJob(
        { id: 'job-1', state: 'failed', attempt: 2, maxAttempts: 2 },
        { type: 'retry' },
        '2026-08-11T00:00:00.000Z'
      )
    ).toThrow('Invalid job transition');
  });
});
