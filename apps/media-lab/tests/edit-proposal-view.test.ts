import { describe, expect, it } from 'vitest';
import { describeEditProposal } from '../src/renderer/app/edit-proposal-view';

describe('edit proposal review details', () => {
  it('shows every concrete operand that will be confirmed', () => {
    expect(describeEditProposal({
      schemaVersion: 1,
      id: 'proposal-1',
      projectId: 'project-1',
      summary: 'Apply reviewed changes.',
      operations: [
        { type: 'update_caption', beatId: 'beat-1', onScreenText: 'Pay before landing' },
        { type: 'trim_beat', beatId: 'beat-1', startMs: 1_000, endMs: 3_000 },
        { type: 'replace_asset', beatId: 'beat-2', assetId: 'asset-owned' },
        { type: 'reorder_beat', beatId: 'beat-2', order: 0 },
        { type: 'set_music_volume', volume: 0.35 },
        { type: 'regenerate_beat', beatId: 'beat-3', instruction: 'Use a practical example.' }
      ]
    })).toEqual([
      'Beat beat-1: caption → “Pay before landing”',
      'Beat beat-1: use source 1000–3000 ms',
      'Beat beat-2: asset → asset-owned',
      'Beat beat-2: move to position 1',
      'Music volume → 35%',
      'Beat beat-3: regenerate → “Use a practical example.”'
    ]);
  });
});
