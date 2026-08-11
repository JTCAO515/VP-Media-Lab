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
      '节拍 beat-1：字幕改为“Pay before landing”',
      '节拍 beat-1：使用原素材 1000–3000 毫秒',
      '节拍 beat-2：替换素材为 asset-owned',
      '节拍 beat-2：移动至第 1 位',
      '音乐音量改为 35%',
      '节拍 beat-3：按“Use a practical example.”重新生成'
    ]);
  });
});
