import {
  selectQwenModel,
  validateEditProposalAgainstStoryboard,
  type EditProposalV1,
  type RenderAssetRights,
  type StoryboardV1
} from '@visepanda/media-lab-domain';

type FetchImplementation = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export interface EditProposalRequest {
  message: string;
  storyboard: StoryboardV1;
  assetRights: Record<string, RenderAssetRights>;
  today: string;
}

export class QwenEditProvider {
  private readonly apiKey: string;
  private readonly fetchImplementation: FetchImplementation;
  private readonly endpoint: string;

  constructor(input: { apiKey: string; endpoint?: string; fetch?: FetchImplementation }) {
    this.apiKey = input.apiKey;
    this.endpoint = input.endpoint ?? 'https://dashscope.aliyuncs.com/compatible-mode/v1';
    this.fetchImplementation = input.fetch ?? fetch;
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
            content: 'You are VP Media Lab\'s editing copilot. Return only one JSON EditProposalV1. You may propose only trim_beat, reorder_beat, replace_asset, update_caption, set_music_volume, or regenerate_beat. Never propose use of reference media, external files, publishing, or factual claims. Do not execute edits.'
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
