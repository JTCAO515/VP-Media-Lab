import { describe, expect, it } from 'vitest';
import {
  ChatConfirmInputSchema,
  ChatDiscardInputSchema,
  ChatProposeInputSchema,
  ProjectCreateInputSchema,
  ProjectGetInputSchema,
  RestoreVersionInputSchema
} from '../src/shared/contracts';

describe('renderer IPC contracts', () => {
  it('accepts only bounded project and chat commands', () => {
    expect(ProjectCreateInputSchema.parse({ title: 'Arrival checklist', language: 'en' })).toEqual({
      title: 'Arrival checklist', language: 'en'
    });
    expect(() => ProjectCreateInputSchema.parse({ title: 'x', language: 'en' })).toThrow();
    expect(() => ProjectGetInputSchema.parse({ id: '' })).toThrow();
    expect(() => ChatProposeInputSchema.parse({ projectId: 'project-1', message: 'x'.repeat(2_001) })).toThrow();
  });

  it('validates confirmation and historical restore payloads before main-process work', () => {
    const confirmation = ChatConfirmInputSchema.parse({
      projectId: 'project-1', proposalId: 'proposal-1', expectedRevision: 3
    });
    expect(confirmation.proposalId).toBe('proposal-1');
    expect(() => ChatConfirmInputSchema.parse({ projectId: 'project-1', proposalId: 'proposal-1', expectedRevision: -1 })).toThrow();
    expect(() => ChatConfirmInputSchema.parse({
      projectId: 'project-1', proposalId: 'proposal-1', expectedRevision: 3, proposal: { id: 'renderer-supplied' }
    })).toThrow();
    expect(ChatDiscardInputSchema.parse({
      projectId: 'project-1', proposalId: 'proposal-1', expectedRevision: 3
    })).toEqual({ projectId: 'project-1', proposalId: 'proposal-1', expectedRevision: 3 });
    expect(RestoreVersionInputSchema.parse({ projectId: 'project-1', revision: 0, restoreId: 'restore-1' })).toEqual({
      projectId: 'project-1', revision: 0, restoreId: 'restore-1'
    });
    expect(() => RestoreVersionInputSchema.parse({ projectId: 'project-1', revision: -1, restoreId: 'restore-1' })).toThrow();
  });
});
