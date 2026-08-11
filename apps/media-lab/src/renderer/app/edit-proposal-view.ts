import type { EditProposalV1 } from '@visepanda/media-lab-domain';

export function describeEditProposal(proposal: EditProposalV1): string[] {
  return proposal.operations.map((operation) => {
    if (operation.type === 'update_caption') return `节拍 ${operation.beatId}：字幕改为“${operation.onScreenText}”`;
    if (operation.type === 'trim_beat') return `节拍 ${operation.beatId}：使用原素材 ${operation.startMs}–${operation.endMs} 毫秒`;
    if (operation.type === 'replace_asset') return `节拍 ${operation.beatId}：替换素材为 ${operation.assetId}`;
    if (operation.type === 'reorder_beat') return `节拍 ${operation.beatId}：移动至第 ${operation.order + 1} 位`;
    if (operation.type === 'set_music_volume') return `音乐音量改为 ${Math.round(operation.volume * 100)}%`;
    return `节拍 ${operation.beatId}：按“${operation.instruction}”重新生成`;
  });
}
