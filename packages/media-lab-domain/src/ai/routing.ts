export type AiTask = 'vision' | 'copy' | 'transcription' | 'embedding' | 'tts';

const modelByTask: Record<AiTask, string> = {
  vision: 'qwen3-vl-flash',
  copy: 'qwen-flash',
  transcription: 'qwen3-asr-flash',
  embedding: 'text-embedding-v4',
  tts: 'qwen-tts'
};

export function selectQwenModel(task: AiTask): string {
  const model = modelByTask[task];
  if (!model) throw new Error(`Unsupported AI task: ${String(task)}`);
  return model;
}
