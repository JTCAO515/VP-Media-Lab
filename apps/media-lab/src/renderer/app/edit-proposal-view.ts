import type { EditProposalV1 } from '@visepanda/media-lab-domain';

export function describeEditProposal(proposal: EditProposalV1): string[] {
  return proposal.operations.map((operation) => {
    if (operation.type === 'update_caption') return `Beat ${operation.beatId}: caption → “${operation.onScreenText}”`;
    if (operation.type === 'trim_beat') return `Beat ${operation.beatId}: use source ${operation.startMs}–${operation.endMs} ms`;
    if (operation.type === 'replace_asset') return `Beat ${operation.beatId}: asset → ${operation.assetId}`;
    if (operation.type === 'reorder_beat') return `Beat ${operation.beatId}: move to position ${operation.order + 1}`;
    if (operation.type === 'set_music_volume') return `Music volume → ${Math.round(operation.volume * 100)}%`;
    return `Beat ${operation.beatId}: regenerate → “${operation.instruction}”`;
  });
}
