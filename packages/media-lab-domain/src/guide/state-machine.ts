import { GuideEventSchema, GuidedProductionRunV1Schema, type GuideEvent, type GuidedProductionRunV1 } from './schemas';

function stepIndex(run: GuidedProductionRunV1, stepId: string): number {
  const index = run.steps.findIndex((step) => step.id === stepId);
  if (index < 0) throw new Error('GUIDE_STEP_NOT_FOUND');
  return index;
}

function requireCurrent(run: GuidedProductionRunV1, index: number, states: readonly string[]): void {
  if (!states.includes(run.steps[index]!.state)) throw new Error('GUIDE_STEP_NOT_ACTIVE');
  if (run.steps.slice(0, index).some((step) => !['completed', 'skipped_optional'].includes(step.state))) {
    throw new Error('GUIDE_PREVIOUS_STEP_INCOMPLETE');
  }
}

function activateNext(run: GuidedProductionRunV1, fromIndex: number): GuidedProductionRunV1 {
  const next = run.steps.findIndex((step, index) => index > fromIndex && step.state === 'pending');
  if (next < 0) return run;
  return { ...run, steps: run.steps.map((step, index) => index === next ? { ...step, state: 'active' as const } : step) };
}

export function transitionGuideRun(untrustedRun: GuidedProductionRunV1, untrustedEvent: GuideEvent): GuidedProductionRunV1 {
  const run = GuidedProductionRunV1Schema.parse(untrustedRun);
  const event = GuideEventSchema.parse(untrustedEvent);
  const index = stepIndex(run, event.stepId);
  const current = run.steps[index]!;
  let next: GuidedProductionRunV1;

  if (event.type === 'evidence_passed') {
    requireCurrent(run, index, ['active']);
    if (current.evidenceMode !== 'automatic') throw new Error('GUIDE_EVIDENCE_NOT_AUTOMATIC');
    next = { ...run, updatedAt: event.at, steps: run.steps.map((step, stepIndex) => stepIndex === index ? { ...step, state: 'ready_for_confirmation' as const } : step) };
  } else if (event.type === 'confirm') {
    requireCurrent(run, index, current.evidenceMode === 'automatic' ? ['ready_for_confirmation'] : ['active']);
    next = { ...run, updatedAt: event.at, steps: run.steps.map((step, stepIndex) => stepIndex === index ? { ...step, state: 'completed' as const, confirmedAt: event.at, blockedReason: null, skippedReason: null } : step) };
    next = activateNext(next, index);
  } else if (event.type === 'block') {
    requireCurrent(run, index, ['active', 'ready_for_confirmation']);
    next = { ...run, updatedAt: event.at, steps: run.steps.map((step, stepIndex) => stepIndex === index ? { ...step, state: 'blocked' as const, blockedReason: event.reason } : step) };
  } else if (event.type === 'resume') {
    requireCurrent(run, index, ['blocked']);
    next = { ...run, updatedAt: event.at, steps: run.steps.map((step, stepIndex) => stepIndex === index ? { ...step, state: 'active' as const, blockedReason: null } : step) };
  } else if (event.type === 'skip_optional') {
    requireCurrent(run, index, ['active']);
    if (!current.optional) throw new Error('GUIDE_STEP_REQUIRED');
    next = { ...run, updatedAt: event.at, steps: run.steps.map((step, stepIndex) => stepIndex === index ? { ...step, state: 'skipped_optional' as const, skippedReason: event.reason, blockedReason: null } : step) };
    next = activateNext(next, index);
  } else {
    if (!['completed', 'skipped_optional', 'active', 'ready_for_confirmation', 'blocked'].includes(current.state)) throw new Error('GUIDE_CANNOT_INVALIDATE');
    next = {
      ...run,
      updatedAt: event.at,
      steps: run.steps.map((step, stepIndex) => {
        if (stepIndex < index) return step;
        if (stepIndex === index) return { ...step, state: 'active' as const, confirmedAt: null, blockedReason: null, skippedReason: null };
        return { ...step, state: 'pending' as const, confirmedAt: null, blockedReason: null, skippedReason: null };
      })
    };
  }
  return GuidedProductionRunV1Schema.parse(next);
}
