import { z } from 'zod';

export const IsoDateSchema = z.string().datetime({ offset: true });
const IdSchema = z.string().min(1).max(128);

export const GuideStepStateSchema = z.enum([
  'pending', 'active', 'ready_for_confirmation', 'completed', 'blocked', 'skipped_optional'
]);

export const GuideEvidenceModeSchema = z.enum(['manual', 'automatic']);

export const WorkflowTemplateStepV1Schema = z.object({
  id: IdSchema,
  title: z.string().min(1).max(240),
  instruction: z.string().min(1).max(8_000),
  why: z.string().min(1).max(4_000),
  expectedResult: z.string().min(1).max(4_000),
  evidenceMode: GuideEvidenceModeSchema,
  optional: z.boolean()
}).strict();

export const WorkflowTemplateV1Schema = z.object({
  schemaVersion: z.literal(1),
  id: IdSchema,
  version: z.number().int().positive(),
  title: z.string().min(1).max(240),
  steps: z.array(WorkflowTemplateStepV1Schema).min(1).max(100)
}).strict().superRefine((template, context) => {
  const ids = new Set<string>();
  for (const step of template.steps) {
    if (ids.has(step.id)) context.addIssue({ code: z.ZodIssueCode.custom, message: `DUPLICATE_GUIDE_STEP:${step.id}` });
    ids.add(step.id);
  }
});

export const GuidedProductionStepV1Schema = WorkflowTemplateStepV1Schema.extend({
  state: GuideStepStateSchema,
  confirmedAt: IsoDateSchema.nullable(),
  blockedReason: z.string().min(1).max(4_000).nullable(),
  skippedReason: z.string().min(1).max(4_000).nullable()
}).strict();

export const GuidedProductionRunV1Schema = z.object({
  schemaVersion: z.literal(1),
  id: IdSchema,
  projectId: IdSchema,
  templateId: IdSchema,
  templateVersion: z.number().int().positive(),
  createdAt: IsoDateSchema,
  updatedAt: IsoDateSchema,
  steps: z.array(GuidedProductionStepV1Schema).min(1).max(100)
}).strict().superRefine((run, context) => {
  const inProgress = run.steps.filter((step) => ['active', 'ready_for_confirmation', 'blocked'].includes(step.state));
  if (inProgress.length > 1) context.addIssue({ code: z.ZodIssueCode.custom, message: 'GUIDE_MULTIPLE_ACTIVE_STEPS' });
  const terminalStates = ['completed', 'skipped_optional'];
  if (inProgress.length === 0 && run.steps.some((step) => !terminalStates.includes(step.state))) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'GUIDE_MISSING_ACTIVE_STEP' });
  }
  for (const [index, step] of run.steps.entries()) {
    const metadataIsEmpty = step.confirmedAt === null && step.blockedReason === null && step.skippedReason === null;
    if (['pending', 'active', 'ready_for_confirmation'].includes(step.state) && !metadataIsEmpty) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: `GUIDE_UNEXPECTED_STEP_METADATA:${step.id}` });
    }
    if (step.state === 'blocked' && (step.blockedReason === null || step.confirmedAt !== null || step.skippedReason !== null)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: `GUIDE_INVALID_BLOCKED_STEP:${step.id}` });
    }
    if (step.state === 'completed' && (step.confirmedAt === null || step.blockedReason !== null || step.skippedReason !== null)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: `GUIDE_INVALID_COMPLETED_STEP:${step.id}` });
    }
    if (step.state === 'skipped_optional' && (!step.optional || step.skippedReason === null || step.confirmedAt !== null || step.blockedReason !== null)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: `GUIDE_INVALID_SKIPPED_STEP:${step.id}` });
    }
    if (terminalStates.includes(step.state) && run.steps.slice(0, index).some((previous) => !terminalStates.includes(previous.state))) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: `GUIDE_OUT_OF_ORDER_TERMINAL_STEP:${step.id}` });
    }
  }
});

export const GuideEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('evidence_passed'), stepId: IdSchema, at: IsoDateSchema }).strict(),
  z.object({ type: z.literal('confirm'), stepId: IdSchema, at: IsoDateSchema }).strict(),
  z.object({ type: z.literal('block'), stepId: IdSchema, at: IsoDateSchema, reason: z.string().min(1).max(4_000) }).strict(),
  z.object({ type: z.literal('resume'), stepId: IdSchema, at: IsoDateSchema }).strict(),
  z.object({ type: z.literal('skip_optional'), stepId: IdSchema, at: IsoDateSchema, reason: z.string().min(1).max(4_000) }).strict(),
  z.object({ type: z.literal('invalidate'), stepId: IdSchema, at: IsoDateSchema, reason: z.string().min(1).max(4_000) }).strict()
]);

export type WorkflowTemplateV1 = z.infer<typeof WorkflowTemplateV1Schema>;
export type GuidedProductionRunV1 = z.infer<typeof GuidedProductionRunV1Schema>;
export type GuidedProductionStepV1 = z.infer<typeof GuidedProductionStepV1Schema>;
export type GuideEvent = z.infer<typeof GuideEventSchema>;
