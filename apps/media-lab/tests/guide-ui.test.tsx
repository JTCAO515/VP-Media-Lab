// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { GuideStepView } from '../src/renderer/features/guide/GuideStepView';
import type { GuidedProductionRunV1 } from '@visepanda/media-lab-domain';

const run: GuidedProductionRunV1 = {
  schemaVersion: 1, id: 'run-1', projectId: 'project-1', templateId: 'template-1', templateVersion: 1,
  createdAt: '2026-08-11T00:00:00.000Z', updatedAt: '2026-08-11T00:00:00.000Z',
  steps: [
    { id: 'choose-platform', title: '选择目标平台', instruction: '选择这次要发布的平台。', why: '平台决定画幅和文案。', expectedResult: '已确定平台。', evidenceMode: 'manual', optional: false, state: 'active', confirmedAt: null, blockedReason: null, skippedReason: null },
    { id: 'import-clips', title: '导入剪映素材', instruction: '导入素材。', why: '剪映负责剪辑。', expectedResult: '素材已导入。', evidenceMode: 'manual', optional: false, state: 'pending', confirmedAt: null, blockedReason: null, skippedReason: null }
  ]
};

describe('GuideStepView', () => {
  it('shows only the current action and requires confirmation before the next action', async () => {
    const onEvent = vi.fn();
    render(<GuideStepView run={run} onEvent={onEvent} />);
    expect(screen.getByRole('heading', { name: '选择目标平台' })).toBeTruthy();
    expect(screen.queryByText('导入剪映素材')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: '确认完成' }));
    expect(onEvent).toHaveBeenCalledWith(expect.objectContaining({ type: 'confirm', stepId: 'choose-platform' }));
  });
});
