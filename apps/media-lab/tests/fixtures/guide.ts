import type { WorkflowTemplateV1 } from '@visepanda/media-lab-domain';

export const guideTemplateFixture: WorkflowTemplateV1 = {
  schemaVersion: 1,
  id: 'guided-video-v1',
  version: 1,
  title: '短视频制作引导',
  steps: [
    { id: 'brief', title: '确认主题', instruction: '确认视频主题。', why: '确保后续素材和剪映操作都围绕同一个目标。', expectedResult: '主题已确认。', evidenceMode: 'automatic', optional: false },
    { id: 'handoff', title: '导入剪映', instruction: '将已选素材导入剪映。', why: '剪映负责专业剪辑。', expectedResult: '素材出现在剪映媒体库。', evidenceMode: 'manual', optional: false },
    { id: 'publish', title: '记录发布', instruction: '手动发布后记录链接。', why: '方便复盘结果。', expectedResult: '发布结果已记录。', evidenceMode: 'manual', optional: true }
  ]
};
