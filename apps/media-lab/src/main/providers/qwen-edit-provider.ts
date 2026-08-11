import {
  selectQwenModel,
  validateEditProposalAgainstStoryboard,
  type EditProposalV1,
  type RenderAssetRights,
  type StoryboardV1
} from '@visepanda/media-lab-domain';
import { DefaultProviderConfig, ProviderConfigSchema } from './provider-config';

type FetchImplementation = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export interface EditProposalRequest {
  message: string;
  storyboard: StoryboardV1;
  assetRights: Record<string, RenderAssetRights>;
  today: string;
}

export interface ProviderConnectionExecution {
  ok: boolean;
  model: string;
  latencyMs: number;
  errorCode: string | null;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export class QwenEditProvider {
  private readonly apiKey: string;
  private readonly fetchImplementation: FetchImplementation;
  private readonly endpoint: string;
  private readonly now: () => number;

  constructor(input: { apiKey: string; endpoint?: string; region?: string; fetch?: FetchImplementation; now?: () => number }) {
    this.apiKey = input.apiKey;
    this.endpoint = ProviderConfigSchema.parse({
      baseUrl: input.endpoint ?? DefaultProviderConfig.baseUrl,
      region: input.region ?? DefaultProviderConfig.region
    }).baseUrl;
    this.fetchImplementation = input.fetch ?? fetch;
    this.now = input.now ?? Date.now;
  }

  async testConnection(): Promise<ProviderConnectionExecution> {
    const model = selectQwenModel('copy');
    const startedAt = this.now();
    const failed = (errorCode: string): ProviderConnectionExecution => ({
      ok: false,
      model,
      latencyMs: Math.max(0, this.now() - startedAt),
      errorCode,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0
    });
    if (this.apiKey.trim().length < 12) return failed('AI_NOT_CONFIGURED');
    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), 15_000);
    try {
      const response = await this.fetchImplementation(`${this.endpoint}/chat/completions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          temperature: 0,
          max_tokens: 4,
          messages: [{ role: 'user', content: 'VP_MEDIA_LAB_CONNECTION_TEST: reply OK' }]
        }),
        signal: abortController.signal
      });
      if (!response.ok) return failed(`AI_PROVIDER_HTTP_${response.status}`);
      const payload = await response.json() as {
        choices?: Array<{ message?: { content?: string } }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
      };
      if (!payload.choices?.[0]?.message?.content) return failed('AI_PROVIDER_INVALID_RESPONSE');
      return {
        ok: true,
        model,
        latencyMs: Math.max(0, this.now() - startedAt),
        errorCode: null,
        inputTokens: payload.usage?.prompt_tokens ?? 0,
        outputTokens: payload.usage?.completion_tokens ?? 0,
        totalTokens: payload.usage?.total_tokens ?? 0
      };
    } catch {
      return failed('AI_PROVIDER_NETWORK');
    } finally {
      clearTimeout(timeout);
    }
  }

  async proposeEdit(input: EditProposalRequest): Promise<EditProposalV1> {
    if (this.apiKey.trim().length < 12) throw new Error('AI_NOT_CONFIGURED');
    const response = await this.fetchImplementation(`${this.endpoint}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: selectQwenModel('copy'),
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: 'You are VP Media Lab\'s editing copilot. Return only one JSON EditProposalV1. You may propose only trim_beat, reorder_beat, replace_asset, update_caption, or set_music_volume. Never propose regenerate_beat until a generated replacement patch is supplied. Never propose use of reference media, external files, publishing, or factual claims. Do not execute edits.'
          },
          {
            role: 'user',
            content: JSON.stringify({ message: input.message, storyboard: input.storyboard, assets: input.assetRights })
          }
        ]
      })
    });
    if (!response.ok) throw new Error(`AI_PROVIDER_ERROR:${response.status}`);
    const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) throw new Error('AI_PROVIDER_INVALID_RESPONSE');
    let proposal: unknown;
    try { proposal = JSON.parse(content); }
    catch { throw new Error('AI_PROVIDER_INVALID_JSON'); }
    return validateEditProposalAgainstStoryboard(proposal, input.storyboard, input.assetRights, input.today);
  }
}
