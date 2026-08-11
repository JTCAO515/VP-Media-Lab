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

  it('runs a bounded connection test without project data or secret leakage', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: 'OK' } }],
      usage: { prompt_tokens: 3, completion_tokens: 1, total_tokens: 4 }
    }), { status: 200 }));
    const provider = new QwenEditProvider({
      apiKey: 'test-provider-key',
      fetch: fetchMock,
      now: (() => { let now = 1_000; return () => (now += 25); })()
    });

    await expect(provider.testConnection()).resolves.toEqual({
      ok: true, model: 'qwen-flash', latencyMs: 25, errorCode: null,
      inputTokens: 3, outputTokens: 1, totalTokens: 4
    });
    const request = fetchMock.mock.calls[0][1];
    expect(String(request.body)).toContain('VP_MEDIA_LAB_CONNECTION_TEST');
    expect(String(request.body)).not.toContain('storyboard');
  });

  it('returns a bounded error code and rejects unsafe constructor endpoints', async () => {
    const provider = new QwenEditProvider({
      apiKey: 'test-provider-key',
      fetch: vi.fn().mockResolvedValue(new Response('private upstream detail', { status: 401 })),
      now: () => 1_000
    });
    await expect(provider.testConnection()).resolves.toMatchObject({
      ok: false, model: 'qwen-flash', errorCode: 'AI_PROVIDER_HTTP_401'
    });
    expect(() => new QwenEditProvider({
      apiKey: 'test-provider-key', endpoint: 'https://example.com/compatible-mode/v1'
    })).toThrow('UNSAFE_PROVIDER_ENDPOINT');
  });
});
