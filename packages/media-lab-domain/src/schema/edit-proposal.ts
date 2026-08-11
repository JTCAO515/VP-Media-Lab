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

  const evolvingBeats = storyboard.beats.map((beat) => ({ ...beat }));
  for (const operation of proposal.operations) {
    if (operation.type === 'set_music_volume') continue;
    if (operation.type === 'regenerate_beat') throw new Error('REGENERATE_REQUIRES_GENERATED_PATCH');
    const beatIndex = evolvingBeats.findIndex((candidate) => candidate.id === operation.beatId);
    if (beatIndex < 0) throw new Error('UNKNOWN_BEAT');
    const beat = evolvingBeats[beatIndex];
    if (operation.type === 'trim_beat' && (operation.startMs >= operation.endMs || operation.endMs > beat.durationMs)) {
      throw new Error('INVALID_TRIM_RANGE');
    }
    if (operation.type === 'replace_asset') {
      const rights = assetRights[operation.assetId];
      if (!rights) throw new Error('ASSET_NOT_FOUND');
      if (rights.assetKind === 'reference') throw new Error('REFERENCE_NOT_RENDERABLE');
      if (!isAssetRenderEligible(rights, today)) throw new Error('ASSET_NOT_RENDERABLE');
    }
    if (operation.type === 'trim_beat') {
      beat.sourceStartMs = (beat.sourceStartMs ?? 0) + operation.startMs;
      beat.durationMs = operation.endMs - operation.startMs;
    }
    if (operation.type === 'replace_asset') beat.selectedAssetId = operation.assetId;
    if (operation.type === 'update_caption') beat.onScreenText = operation.onScreenText;
    if (operation.type === 'reorder_beat') {
      evolvingBeats.splice(beatIndex, 1);
      evolvingBeats.splice(Math.min(operation.order, evolvingBeats.length), 0, beat);
    }
  }
  return proposal;
}

export function applyEditProposal(
  proposalInput: unknown,
  storyboardInput: StoryboardV1,
  assetRights: Record<string, RenderAssetRights>,
  today: string
): StoryboardV1 {
  const proposal = validateEditProposalAgainstStoryboard(proposalInput, storyboardInput, assetRights, today);
  const storyboard = StoryboardV1Schema.parse(storyboardInput);
  let beats = storyboard.beats.map((beat) => ({ ...beat }));
  let musicVolume = storyboard.musicVolume;

  for (const operation of proposal.operations) {
    if (operation.type === 'set_music_volume') {
      musicVolume = operation.volume;
      continue;
    }
    if (operation.type === 'regenerate_beat') throw new Error('REGENERATE_REQUIRES_GENERATED_PATCH');

    const beatIndex = beats.findIndex((candidate) => candidate.id === operation.beatId);
    if (beatIndex < 0) throw new Error('UNKNOWN_BEAT');
    const beat = beats[beatIndex];
    if (operation.type === 'update_caption') beat.onScreenText = operation.onScreenText;
    if (operation.type === 'replace_asset') beat.selectedAssetId = operation.assetId;
    if (operation.type === 'trim_beat') {
      beat.sourceStartMs = (beat.sourceStartMs ?? 0) + operation.startMs;
      beat.durationMs = operation.endMs - operation.startMs;
    }
    if (operation.type === 'reorder_beat') {
      beats.splice(beatIndex, 1);
      beats.splice(Math.min(operation.order, beats.length), 0, beat);
    }
  }

  beats = beats.map((beat, order) => ({ ...beat, order }));
  return StoryboardV1Schema.parse({ ...storyboard, musicVolume, beats });
}
