import { describe, expect, it } from 'vitest';
import { selectQwenModel } from '@visepanda/media-lab-domain';

describe('Qwen model routing', () => {
  it('routes each supported task through a single approved model id', () => {
    expect(selectQwenModel('vision')).toBe('qwen3-vl-flash');
    expect(selectQwenModel('copy')).toBe('qwen-flash');
    expect(selectQwenModel('transcription')).toBe('qwen3-asr-flash');
    expect(selectQwenModel('embedding')).toBe('text-embedding-v4');
  });

  it('does not route MVP work to generative video', () => {
    expect(() => selectQwenModel('video_generation' as never)).toThrow('Unsupported AI task');
  });
});
