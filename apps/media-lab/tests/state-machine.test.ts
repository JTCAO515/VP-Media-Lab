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
});
