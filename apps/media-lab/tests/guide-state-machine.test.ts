import { describe, expect, it } from 'vitest';
import {
  GuidedProductionRunV1Schema,
  transitionGuideRun,
  type GuidedProductionRunV1
} from '@visepanda/media-lab-domain';
import { guideTemplateFixture as template } from './fixtures/guide';

const NOW = '2026-08-11T00:00:00.000Z';

function runFixture(): GuidedProductionRunV1 {
  return {
    schemaVersion: 1,
    id: 'run-1',
    projectId: 'project-1',
    templateId: template.id,
    templateVersion: template.version,
    createdAt: NOW,
    updatedAt: NOW,
    steps: template.steps.map((step, index) => ({
      ...step,
      state: index === 0 ? 'active' : 'pending',
      confirmedAt: null,
      blockedReason: null,
      skippedReason: null
    }))
  };
}

describe('guided production state machine', () => {
  it('requires confirmation after automatic evidence and invalidates descendants', () => {
    const ready = transitionGuideRun(runFixture(), { type: 'evidence_passed', stepId: 'brief', at: NOW });
    expect(ready.steps[0]?.state).toBe('ready_for_confirmation');
    const confirmed = transitionGuideRun(ready, { type: 'confirm', stepId: 'brief', at: NOW });
    expect(confirmed.steps.map((step) => step.state)).toEqual(['completed', 'active', 'pending']);
    const invalidated = transitionGuideRun(confirmed, { type: 'invalidate', stepId: 'brief', at: NOW, reason: '主题已变化' });
    expect(invalidated.steps.map((step) => step.state)).toEqual(['active', 'pending', 'pending']);
  });

  it('keeps required steps mandatory and records optional skips and blocked recovery', () => {
    expect(() => transitionGuideRun(runFixture(), { type: 'skip_optional', stepId: 'brief', at: NOW, reason: '跳过' })).toThrow('GUIDE_STEP_REQUIRED');
    const blocked = transitionGuideRun(runFixture(), { type: 'block', stepId: 'brief', at: NOW, reason: '找不到素材' });
    expect(blocked.steps[0]).toMatchObject({ state: 'blocked', blockedReason: '找不到素材' });
    const resumed = transitionGuideRun(blocked, { type: 'resume', stepId: 'brief', at: NOW });
    expect(resumed.steps[0]?.state).toBe('active');
    const ready = transitionGuideRun(resumed, { type: 'evidence_passed', stepId: 'brief', at: NOW });
    const afterBrief = transitionGuideRun(ready, { type: 'confirm', stepId: 'brief', at: NOW });
    const afterHandoff = transitionGuideRun(afterBrief, { type: 'confirm', stepId: 'handoff', at: NOW });
    const optional = transitionGuideRun(afterHandoff, { type: 'skip_optional', stepId: 'publish', at: NOW, reason: '暂不发布' });
    expect(optional.steps[2]).toMatchObject({ state: 'skipped_optional', skippedReason: '暂不发布' });
  });

  it('rejects malformed snapshots that violate step-state or linear ordering invariants', () => {
    const malformed = runFixture();
    malformed.steps[0] = { ...malformed.steps[0]!, state: 'blocked', blockedReason: null };
    expect(GuidedProductionRunV1Schema.safeParse(malformed).success).toBe(false);

    const outOfOrder = runFixture();
    outOfOrder.steps[2] = { ...outOfOrder.steps[2]!, state: 'completed', confirmedAt: NOW };
    expect(GuidedProductionRunV1Schema.safeParse(outOfOrder).success).toBe(false);
  });
});
