import { spawn } from 'node:child_process';

export function buildThumbnailArgs(inputPath: string, outputPath: string): string[] {
  return ['-y', '-ss', '00:00:01.000', '-i', inputPath, '-frames:v', '1', '-vf', 'scale=720:-2', outputPath];
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
