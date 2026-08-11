import { describe, expect, it } from 'vitest';
import { applyEditProposal, validateEditProposalAgainstStoryboard } from '../../../packages/media-lab-domain/src/schema/edit-proposal';

const storyboard = {
  schemaVersion: 1 as const,
  id: 'storyboard-1',
  projectId: 'project-1',
  evidencePackId: null,
  language: 'en' as const,
  beats: [{
    id: 'beat-1', order: 0, durationMs: 5_000, purpose: 'hook', originalScript: 'Arrive prepared.',
    onScreenText: 'China arrival', sourceFactIds: [], candidateAssetIds: ['asset-owned', 'asset-reference'],
    selectedAssetId: 'asset-owned', renderStatus: 'draft' as const
  }],
  factualReview: 'not_required' as const,
  originalityReview: 'required' as const
};

describe('edit proposal validation', () => {
  it('applies a confirmed caption proposal without mutating the original storyboard', () => {
    const revised = applyEditProposal({
      schemaVersion: 1,
      id: 'proposal-2',
      projectId: 'project-1',
      summary: 'Use a shorter caption.',
      operations: [{ type: 'update_caption', beatId: 'beat-1', onScreenText: 'Pay before landing' }]
    }, storyboard, {}, '2026-08-11');

    expect(revised.beats[0].onScreenText).toBe('Pay before landing');
    expect(storyboard.beats[0].onScreenText).toBe('China arrival');
  });

  it('applies trim, replacement, reorder, and music changes deterministically', () => {
    const twoBeatStoryboard = {
      ...storyboard,
      beats: [
        storyboard.beats[0],
        {
          ...storyboard.beats[0], id: 'beat-2', order: 1, durationMs: 4_000,
          purpose: 'proof', onScreenText: 'Use your own footage', selectedAssetId: null
        }
      ]
    };

    const revised = applyEditProposal({
      schemaVersion: 1,
      id: 'proposal-3',
      projectId: 'project-1',
      summary: 'Tighten the opening and move proof first.',
      operations: [
        { type: 'trim_beat', beatId: 'beat-1', startMs: 750, endMs: 4_250 },
        { type: 'replace_asset', beatId: 'beat-2', assetId: 'asset-licensed' },
        { type: 'reorder_beat', beatId: 'beat-2', order: 0 },
        { type: 'set_music_volume', volume: 0.35 }
      ]
    }, twoBeatStoryboard, {
      'asset-licensed': { assetKind: 'owned', rightsStatus: 'licensed', rightsExpiresAt: null }
    }, '2026-08-11');

    expect(revised.musicVolume).toBe(0.35);
    expect(revised.beats.map((beat) => [beat.id, beat.order])).toEqual([['beat-2', 0], ['beat-1', 1]]);
    expect(revised.beats[0].selectedAssetId).toBe('asset-licensed');
    expect(revised.beats[1]).toMatchObject({ sourceStartMs: 750, durationMs: 3_500 });
  });

  it('does not apply a regenerate instruction without a generated replacement patch', () => {
    const proposal = {
      schemaVersion: 1,
      id: 'proposal-4',
      projectId: 'project-1',
      summary: 'Regenerate the hook.',
      operations: [{ type: 'regenerate_beat', beatId: 'beat-1', instruction: 'Make it more practical.' }]
    } as const;
    expect(() => validateEditProposalAgainstStoryboard(proposal, storyboard, {}, '2026-08-11'))
      .toThrow('REGENERATE_REQUIRES_GENERATED_PATCH');
    expect(() => applyEditProposal(proposal, storyboard, {}, '2026-08-11'))
      .toThrow('REGENERATE_REQUIRES_GENERATED_PATCH');
  });

  it('rejects a Chatbot proposal that would replace a beat with reference media', () => {
    expect(() => validateEditProposalAgainstStoryboard({
      schemaVersion: 1,
      id: 'proposal-1',
      projectId: 'project-1',
      summary: 'Use the reference clip as a stronger opening.',
      operations: [{ type: 'replace_asset', beatId: 'beat-1', assetId: 'asset-reference' }]
    }, storyboard, {
      'asset-reference': { assetKind: 'reference', rightsStatus: 'licensed', rightsExpiresAt: null }
    }, '2026-08-11')).toThrow('REFERENCE_NOT_RENDERABLE');
  });

  it('rejects sequential trims that become invalid against the evolving beat', () => {
    expect(() => validateEditProposalAgainstStoryboard({
      schemaVersion: 1,
      id: 'proposal-multi-trim',
      projectId: 'project-1',
      summary: 'Apply two trims.',
      operations: [
        { type: 'trim_beat', beatId: 'beat-1', startMs: 1_000, endMs: 5_000 },
        { type: 'trim_beat', beatId: 'beat-1', startMs: 0, endMs: 4_500 }
      ]
    }, storyboard, {}, '2026-08-11')).toThrow('INVALID_TRIM_RANGE');
  });
});
