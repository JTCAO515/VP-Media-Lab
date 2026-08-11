import { afterEach, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { buildThumbnailArgs, createThumbnail } from '../src/main/worker/ffmpeg';

const temporaryDirectories: string[] = [];
afterEach(async () => { await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))); });

describe('FFmpeg thumbnail command', () => {
  it('uses argument arrays and writes one scaled frame to an explicit output path', () => {
    expect(buildThumbnailArgs('C:\\source clips\\arrival.mp4', 'C:\\cache\\thumb.jpg')).toEqual([
      '-y', '-ss', '00:00:00.500', '-i', 'C:\\source clips\\arrival.mp4', '-frames:v', '1',
      '-vf', 'scale=720:-2', 'C:\\cache\\thumb.jpg'
    ]);
  });

  it('writes a thumbnail into cache without modifying the source video', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'vp-media-lab-'));
    temporaryDirectories.push(directory);
    const binary = join(process.cwd(), 'node_modules', 'ffmpeg-static', 'ffmpeg.exe');
    const source = join(directory, 'source.mp4');
    execFileSync(binary, ['-y', '-f', 'lavfi', '-i', 'color=c=red:s=160x90:d=1', '-pix_fmt', 'yuv420p', source]);
    const before = createHash('sha256').update(await readFile(source)).digest('hex');

    const thumbnail = await createThumbnail({ binaryPath: binary, inputPath: source, cacheDirectory: join(directory, 'cache'), assetId: 'asset-1' });

    expect(thumbnail).toMatch(/asset-1\\thumbnail\.jpg$/);
    expect((await readFile(thumbnail)).byteLength).toBeGreaterThan(0);
    expect(createHash('sha256').update(await readFile(source)).digest('hex')).toBe(before);
  });
});
