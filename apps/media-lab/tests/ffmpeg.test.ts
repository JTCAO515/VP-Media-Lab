import { describe, expect, it } from 'vitest';
import { buildThumbnailArgs } from '../src/main/worker/ffmpeg';

describe('FFmpeg thumbnail command', () => {
  it('uses argument arrays and writes one scaled frame to an explicit output path', () => {
    expect(buildThumbnailArgs('C:\\source clips\\arrival.mp4', 'C:\\cache\\thumb.jpg')).toEqual([
      '-y', '-ss', '00:00:01.000', '-i', 'C:\\source clips\\arrival.mp4', '-frames:v', '1',
      '-vf', 'scale=720:-2', 'C:\\cache\\thumb.jpg'
    ]);
  });
});
