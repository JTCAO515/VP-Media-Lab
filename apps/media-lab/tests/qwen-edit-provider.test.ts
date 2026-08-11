import { describe, expect, it, vi } from 'vitest';
import { QwenEditProvider } from '../src/main/providers/qwen-edit-provider';

const storyboard = {
  schemaVersion: 1 as const, id: 'storyboard-1', projectId: 'project-1', evidencePackId: null, language: 'en' as const,
  beats: [{ id: 'beat-1', order: 0, durationMs: 5_000, purpose: 'hook', originalScript: '', onScreenText: '', sourceFactIds: [], candidateAssetIds: [], selectedAssetId: null, renderStatus: 'draft' as const }],
  factualReview: 'not_required' as const, originalityReview: 'required' as const
};

describe('Qwen edit provider', () => {
  it('returns only a locally validated editing proposal from a compatible API response', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({
        schemaVersion: 1, id: 'proposal-1', projectId: 'project-1', summary: 'Shorten the on-screen copy.',
        operations: [{ type: 'update_caption', beatId: 'beat-1', onScreenText: 'Pay before you land' }]
      }) } }]
    }), { status: 200 }));
    const provider = new QwenEditProvider({ apiKey: 'test-provider-key', fetch: fetchMock });

    const proposal = await provider.proposeEdit({ message: 'Make the first caption shorter.', storyboard, assetRights: {}, today: '2026-08-11' });

    expect(proposal.operations).toEqual([{ type: 'update_caption', beatId: 'beat-1', onScreenText: 'Pay before you land' }]);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(String(fetchMock.mock.calls[0][1].body)).not.toContain('test-provider-key');
  });
});
