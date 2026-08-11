import { describe, expect, it } from 'vitest';
import {
  PatternCardV1Schema,
  StoryboardV1Schema,
  isAssetRenderEligible
} from '@visepanda/media-lab-domain';

describe('content schemas', () => {
  it('accepts a versioned Pattern Card with replacement constraints', () => {
    expect(
      PatternCardV1Schema.parse({
        schemaVersion: 1,
        id: 'pattern-1',
        referenceItemId: 'reference-1',
        platform: 'tiktok',
        audience: 'first-time China visitors',
        promise: 'arrive prepared',
        emotionalTrigger: 'confidence',
        hook: { type: 'problem', summary: 'Avoid a payment surprise', durationMs: 1200 },
        beats: [{ id: 'beat-1', startMs: 0, endMs: 1200, purpose: 'hook', shotCategory: 'closeup', pace: 'fast' }],
        captions: { layout: 'center', density: 'high', emphasis: ['payment'] },
        cta: 'Save this checklist',
        chinaTravelTransfer: ['Use owned footage of payment setup'],
        replaceRequirements: ['Do not reuse source wording or shots'],
        originalityNotes: ['Rewrite examples for approved evidence']
      })
    ).toMatchObject({ schemaVersion: 1, id: 'pattern-1' });
  });

  it('rejects a storyboard beat that uses an unapproved factual claim', () => {
    expect(() =>
      StoryboardV1Schema.parse({
        schemaVersion: 1,
        id: 'storyboard-1',
        projectId: 'project-1',
        evidencePackId: null,
        language: 'en',
        factualReview: 'approved',
        originalityReview: 'approved',
        beats: [{
          id: 'beat-1', order: 0, durationMs: 1000, purpose: 'hook', originalScript: 'A claim',
          onScreenText: 'A claim', sourceFactIds: [], candidateAssetIds: ['asset-1'],
          selectedAssetId: 'asset-1', renderStatus: 'approved'
        }]
      })
    ).toThrow('approved factual review requires evidence');
  });

  it('never makes a reference or expired asset eligible for rendering', () => {
    expect(
      isAssetRenderEligible({ assetKind: 'reference', rightsStatus: 'licensed', rightsExpiresAt: null }, '2026-08-11')
    ).toBe(false);
    expect(
      isAssetRenderEligible({ assetKind: 'owned', rightsStatus: 'licensed', rightsExpiresAt: '2026-08-10' }, '2026-08-11')
    ).toBe(false);
    expect(
      isAssetRenderEligible({ assetKind: 'owned', rightsStatus: 'owned', rightsExpiresAt: null }, '2026-08-11')
    ).toBe(true);
  });
});
