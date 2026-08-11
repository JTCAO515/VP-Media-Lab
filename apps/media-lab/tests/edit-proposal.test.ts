import { describe, expect, it } from 'vitest';
import { validateEditProposalAgainstStoryboard } from '../../../packages/media-lab-domain/src/schema/edit-proposal';

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
});
