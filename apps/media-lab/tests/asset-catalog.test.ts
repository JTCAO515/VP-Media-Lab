import { describe, expect, it } from 'vitest';
import { reconcileAssetLocation } from '@visepanda/media-lab-domain';

describe('asset catalog reconciliation', () => {
  it('deduplicates the same content hash while retaining a new observed location', () => {
    expect(
      reconcileAssetLocation(
        { id: 'asset-1', contentHash: 'same-hash', locations: ['C:\\footage\\clip.mp4'], missing: false },
        { path: 'D:\\archive\\clip-copy.mp4', contentHash: 'same-hash' }
      )
    ).toEqual({
      id: 'asset-1', contentHash: 'same-hash',
      locations: ['C:\\footage\\clip.mp4', 'D:\\archive\\clip-copy.mp4'], missing: false
    });
  });

  it('marks an asset missing without discarding its metadata when no location is available', () => {
    expect(
      reconcileAssetLocation(
        { id: 'asset-1', contentHash: 'same-hash', locations: ['C:\\footage\\clip.mp4'], missing: false },
        { path: null, contentHash: 'same-hash' }
      )
    ).toMatchObject({ id: 'asset-1', locations: ['C:\\footage\\clip.mp4'], missing: true });
  });
});
