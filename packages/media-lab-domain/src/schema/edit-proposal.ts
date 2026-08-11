import { z } from 'zod';
import { isAssetRenderEligible, type RenderAssetRights } from '../rights/render-eligibility';
import { StoryboardV1Schema, type StoryboardV1 } from './content';

const IdSchema = z.string().min(1);

export const EditOperationV1Schema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('trim_beat'), beatId: IdSchema, startMs: z.number().int().nonnegative(), endMs: z.number().int().positive() }),
  z.object({ type: z.literal('reorder_beat'), beatId: IdSchema, order: z.number().int().nonnegative() }),
  z.object({ type: z.literal('replace_asset'), beatId: IdSchema, assetId: IdSchema }),
  z.object({ type: z.literal('update_caption'), beatId: IdSchema, onScreenText: z.string().max(280) }),
  z.object({ type: z.literal('set_music_volume'), volume: z.number().min(0).max(1) }),
  z.object({ type: z.literal('regenerate_beat'), beatId: IdSchema, instruction: z.string().min(1).max(500) })
]);

export const EditProposalV1Schema = z.object({
  schemaVersion: z.literal(1),
  id: IdSchema,
  projectId: IdSchema,
  summary: z.string().min(1).max(500),
  operations: z.array(EditOperationV1Schema).min(1).max(12)
});

export type EditProposalV1 = z.infer<typeof EditProposalV1Schema>;

export function validateEditProposalAgainstStoryboard(
  proposalInput: unknown,
  storyboardInput: StoryboardV1,
  assetRights: Record<string, RenderAssetRights>,
  today: string
): EditProposalV1 {
  const proposal = EditProposalV1Schema.parse(proposalInput);
  const storyboard = StoryboardV1Schema.parse(storyboardInput);
  if (proposal.projectId !== storyboard.projectId) throw new Error('PROJECT_MISMATCH');

  const beatsById = new Map(storyboard.beats.map((beat) => [beat.id, beat]));
  for (const operation of proposal.operations) {
    if (operation.type === 'set_music_volume') continue;
    const beat = beatsById.get(operation.beatId);
    if (!beat) throw new Error('UNKNOWN_BEAT');
    if (operation.type === 'trim_beat' && (operation.startMs >= operation.endMs || operation.endMs > beat.durationMs)) {
      throw new Error('INVALID_TRIM_RANGE');
    }
    if (operation.type === 'replace_asset') {
      const rights = assetRights[operation.assetId];
      if (!rights) throw new Error('ASSET_NOT_FOUND');
      if (rights.assetKind === 'reference') throw new Error('REFERENCE_NOT_RENDERABLE');
      if (!isAssetRenderEligible(rights, today)) throw new Error('ASSET_NOT_RENDERABLE');
    }
  }
  return proposal;
}
