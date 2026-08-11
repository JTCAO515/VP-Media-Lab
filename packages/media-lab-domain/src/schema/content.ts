import { z } from 'zod';

const IdSchema = z.string().min(1);

export const PatternCardV1Schema = z.object({
  schemaVersion: z.literal(1),
  id: IdSchema,
  referenceItemId: IdSchema,
  platform: z.enum(['tiktok', 'instagram', 'facebook', 'reddit', 'other']),
  audience: z.string().min(1),
  promise: z.string().min(1),
  emotionalTrigger: z.string().min(1),
  hook: z.object({ type: z.string().min(1), summary: z.string().min(1), durationMs: z.number().int().positive() }),
  beats: z.array(z.object({
    id: IdSchema,
    startMs: z.number().int().nonnegative(),
    endMs: z.number().int().positive(),
    purpose: z.string().min(1),
    shotCategory: z.string().min(1),
    pace: z.enum(['slow', 'medium', 'fast'])
  })).min(1),
  captions: z.object({ layout: z.string().min(1), density: z.enum(['low', 'medium', 'high']), emphasis: z.array(z.string()) }),
  cta: z.string(),
  chinaTravelTransfer: z.array(z.string()),
  replaceRequirements: z.array(z.string()).min(1),
  originalityNotes: z.array(z.string()).min(1)
});

const StoryboardBeatSchema = z.object({
  id: IdSchema,
  order: z.number().int().nonnegative(),
  durationMs: z.number().int().positive(),
  purpose: z.string().min(1),
  originalScript: z.string(),
  onScreenText: z.string(),
  sourceFactIds: z.array(IdSchema),
  candidateAssetIds: z.array(IdSchema),
  selectedAssetId: IdSchema.nullable(),
  renderStatus: z.enum(['draft', 'review_required', 'approved'])
});

export const StoryboardV1Schema = z.object({
  schemaVersion: z.literal(1),
  id: IdSchema,
  projectId: IdSchema,
  evidencePackId: IdSchema.nullable(),
  language: z.enum(['en', 'zh', 'other']),
  beats: z.array(StoryboardBeatSchema).min(1),
  factualReview: z.enum(['not_required', 'required', 'approved']),
  originalityReview: z.enum(['required', 'approved', 'rejected'])
}).superRefine((storyboard, context) => {
  if (storyboard.factualReview === 'approved' && storyboard.beats.some((beat) => beat.sourceFactIds.length === 0)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'approved factual review requires evidence' });
  }
});

export type PatternCardV1 = z.infer<typeof PatternCardV1Schema>;
export type StoryboardV1 = z.infer<typeof StoryboardV1Schema>;
