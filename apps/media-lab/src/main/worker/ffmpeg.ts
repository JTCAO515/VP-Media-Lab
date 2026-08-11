import { spawn } from 'node:child_process';
import { mkdir, rename } from 'node:fs/promises';
import { join } from 'node:path';

export function buildThumbnailArgs(inputPath: string, outputPath: string): string[] {
  return ['-y', '-ss', '00:00:00.500', '-i', inputPath, '-frames:v', '1', '-vf', 'scale=720:-2', outputPath];
}

export function runFfmpeg(binaryPath: string, args: string[], signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const process = spawn(binaryPath, args, { windowsHide: true });
    let stderr = '';
    process.stderr.on('data', (chunk) => { stderr += String(chunk); });
    process.once('error', reject);
    process.once('close', (code) => code === 0 ? resolve() : reject(new Error(`FFmpeg exited with ${code}: ${stderr.slice(-500)}`)));
    signal?.addEventListener('abort', () => process.kill(), { once: true });
  });
}

export async function createThumbnail(input: {
  binaryPath: string;
  inputPath: string;
  cacheDirectory: string;
  assetId: string;
  signal?: AbortSignal;
}): Promise<string> {
  const assetCache = join(input.cacheDirectory, input.assetId);
  const staging = join(input.cacheDirectory, 'staging');
  const output = join(assetCache, 'thumbnail.jpg');
  const temporary = join(staging, `${input.assetId}.thumbnail.partial.jpg`);
  await mkdir(assetCache, { recursive: true });
  await mkdir(staging, { recursive: true });
  await runFfmpeg(input.binaryPath, buildThumbnailArgs(input.inputPath, temporary), input.signal);
  await rename(temporary, output);
  return output;
}
