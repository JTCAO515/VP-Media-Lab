import {
  EditProposalV1Schema,
  StoryboardV1Schema,
  applyEditProposal,
  type EditProposalV1,
  type RenderAssetRights,
  type StoryboardV1
} from '@visepanda/media-lab-domain';
import { createHash } from 'node:crypto';
import type { MediaLabDatabase } from './database';

export interface CreateProjectWithStoryboardInput {
  id: string;
  title: string;
  createdAt: string;
  storyboard: StoryboardV1;
}

export interface StoredProject {
  id: string;
  title: string;
  createdAt: string;
  revision: number;
  storyboard: StoryboardV1;
}

export interface ApplyConfirmedEditProposalInput {
  proposal: EditProposalV1;
  assetRights: Record<string, RenderAssetRights>;
  today: string;
  appliedAt: string;
}

export interface AppliedStoryboardRevision {
  project: StoredProject;
  revision: number;
}

export interface RestoreStoryboardVersionInput {
  projectId: string;
  revision: number;
  restoreId: string;
  restoredAt: string;
}

export interface StorePendingEditProposalInput {
  proposal: EditProposalV1;
  expectedRevision: number;
  storedAt: string;
}

export interface StoredPendingEditProposal {
  proposal: EditProposalV1;
  baseRevision: number;
  payloadHash: string;
}

export interface ConfirmPendingEditProposalInput {
  projectId: string;
  proposalId: string;
  expectedRevision: number;
  assetRights: Record<string, RenderAssetRights>;
  today: string;
  appliedAt: string;
}

export interface DiscardPendingEditProposalInput {
  projectId: string;
  proposalId: string;
  expectedRevision: number;
  discardedAt: string;
}

function proposalHash(payload: string): string {
  return createHash('sha256').update(payload).digest('hex');
}

export function createProjectWithStoryboard(database: MediaLabDatabase, input: CreateProjectWithStoryboardInput): StoredProject {
  const storyboard = StoryboardV1Schema.parse(input.storyboard);
  if (storyboard.projectId !== input.id) throw new Error('PROJECT_STORYBOARD_MISMATCH');
  return database.transaction(() => {
    database.run('INSERT INTO projects (id, title, created_at) VALUES (?, ?, ?);', [input.id, input.title, input.createdAt]);
    database.run(
      'INSERT INTO storyboards (project_id, id, schema_version, payload, updated_at) VALUES (?, ?, ?, ?, ?);',
      [input.id, storyboard.id, storyboard.schemaVersion, JSON.stringify(storyboard), input.createdAt]
    );
    return { id: input.id, title: input.title, createdAt: input.createdAt, revision: 0, storyboard };
  });
}

export function getProjectWithStoryboard(database: MediaLabDatabase, projectId: string): StoredProject | null {
  const row = database.all(
    'SELECT projects.id, projects.title, projects.created_at, storyboards.payload, storyboards.revision FROM projects JOIN storyboards ON storyboards.project_id = projects.id WHERE projects.id = ?;',
    [projectId]
  )[0];
  if (!row) return null;
  return {
    id: String(row.id), title: String(row.title), createdAt: String(row.created_at), revision: Number(row.revision),
    storyboard: StoryboardV1Schema.parse(JSON.parse(String(row.payload)))
  };
}

export function applyConfirmedEditProposal(
  database: MediaLabDatabase,
  input: ApplyConfirmedEditProposalInput
): AppliedStoryboardRevision {
  const proposal = EditProposalV1Schema.parse(input.proposal);

  return database.transaction(() => {
    const existing = database.all(
      'SELECT revision FROM storyboard_versions WHERE proposal_id = ?;',
      [proposal.id]
    )[0];
    if (existing) throw new Error('PROPOSAL_ALREADY_APPLIED');

    const row = database.all(
      `SELECT projects.id, projects.title, projects.created_at, storyboards.schema_version,
        storyboards.payload, storyboards.revision
       FROM projects JOIN storyboards ON storyboards.project_id = projects.id
       WHERE projects.id = ?;`,
      [proposal.projectId]
    )[0];
    if (!row) throw new Error('PROJECT_NOT_FOUND');

    const currentStoryboard = StoryboardV1Schema.parse(JSON.parse(String(row.payload)));
    const revisedStoryboard = applyEditProposal(proposal, currentStoryboard, input.assetRights, input.today);
    const currentRevision = Number(row.revision);
    const nextRevision = currentRevision + 1;

    database.run(
      `INSERT OR IGNORE INTO storyboard_versions
        (project_id, revision, proposal_id, schema_version, payload, created_at)
       VALUES (?, ?, NULL, ?, ?, ?);`,
      [proposal.projectId, currentRevision, Number(row.schema_version), String(row.payload), input.appliedAt]
    );
    database.run(
      `INSERT INTO storyboard_versions
        (project_id, revision, proposal_id, schema_version, payload, created_at)
       VALUES (?, ?, ?, ?, ?, ?);`,
      [proposal.projectId, nextRevision, proposal.id, revisedStoryboard.schemaVersion, JSON.stringify(revisedStoryboard), input.appliedAt]
    );
    const update = database.run(
      `UPDATE storyboards SET schema_version = ?, payload = ?, updated_at = ?, revision = ?
       WHERE project_id = ? AND revision = ?;`,
      [
        revisedStoryboard.schemaVersion,
        JSON.stringify(revisedStoryboard),
        input.appliedAt,
        nextRevision,
        proposal.projectId,
        currentRevision
      ]
    );
    if (Number(update.changes) !== 1) throw new Error('STORYBOARD_REVISION_CONFLICT');

    return {
      project: {
        id: String(row.id),
        title: String(row.title),
        createdAt: String(row.created_at),
        revision: nextRevision,
        storyboard: revisedStoryboard
      },
      revision: nextRevision
    };
  });
}

export function storePendingEditProposal(
  database: MediaLabDatabase,
  input: StorePendingEditProposalInput
): StoredPendingEditProposal {
  const proposal = EditProposalV1Schema.parse(input.proposal);
  return database.transaction(() => {
    const head = database.all('SELECT revision FROM storyboards WHERE project_id = ?;', [proposal.projectId])[0];
    if (!head) throw new Error('PROJECT_NOT_FOUND');
    const baseRevision = Number(head.revision);
    if (baseRevision !== input.expectedRevision) throw new Error('STALE_PROPOSAL');
    const payload = JSON.stringify(proposal);
    const payloadHash = proposalHash(payload);
    database.run(
      `INSERT INTO pending_edit_proposals
        (proposal_id, project_id, base_revision, payload, payload_hash, status, created_at, confirmed_at)
       VALUES (?, ?, ?, ?, ?, 'pending', ?, NULL);`,
      [proposal.id, proposal.projectId, baseRevision, payload, payloadHash, input.storedAt]
    );
    return { proposal, baseRevision, payloadHash };
  });
}

export function confirmPendingEditProposal(
  database: MediaLabDatabase,
  input: ConfirmPendingEditProposalInput
): AppliedStoryboardRevision {
  return database.transaction(() => {
    const pending = database.all(
      `SELECT project_id, base_revision, payload, payload_hash
       FROM pending_edit_proposals WHERE proposal_id = ? AND status = 'pending';`,
      [input.proposalId]
    )[0];
    if (!pending) throw new Error('PENDING_PROPOSAL_NOT_FOUND');
    if (String(pending.project_id) !== input.projectId) throw new Error('PROJECT_MISMATCH');
    const baseRevision = Number(pending.base_revision);
    if (baseRevision !== input.expectedRevision) throw new Error('STALE_PROPOSAL');
    const head = database.all('SELECT revision FROM storyboards WHERE project_id = ?;', [input.projectId])[0];
    if (!head) throw new Error('PROJECT_NOT_FOUND');
    if (Number(head.revision) !== baseRevision) throw new Error('STALE_PROPOSAL');
    const payload = String(pending.payload);
    if (proposalHash(payload) !== String(pending.payload_hash)) throw new Error('PENDING_PROPOSAL_CORRUPT');
    const proposal = EditProposalV1Schema.parse(JSON.parse(payload));

    const result = applyConfirmedEditProposal(database, {
      proposal,
      assetRights: input.assetRights,
      today: input.today,
      appliedAt: input.appliedAt
    });
    const update = database.run(
      `UPDATE pending_edit_proposals SET status = 'confirmed', confirmed_at = ?
       WHERE proposal_id = ? AND status = 'pending';`,
      [input.appliedAt, input.proposalId]
    );
    if (Number(update.changes) !== 1) throw new Error('PENDING_PROPOSAL_CONFLICT');
    return result;
  });
}

export function discardPendingEditProposal(
  database: MediaLabDatabase,
  input: DiscardPendingEditProposalInput
): void {
  database.transaction(() => {
    const pending = database.all(
      `SELECT project_id, base_revision FROM pending_edit_proposals
       WHERE proposal_id = ? AND status = 'pending';`,
      [input.proposalId]
    )[0];
    if (!pending) throw new Error('PENDING_PROPOSAL_NOT_FOUND');
    if (String(pending.project_id) !== input.projectId) throw new Error('PROJECT_MISMATCH');
    if (Number(pending.base_revision) !== input.expectedRevision) throw new Error('STALE_PROPOSAL');
    const update = database.run(
      `UPDATE pending_edit_proposals SET status = 'discarded', discarded_at = ?
       WHERE proposal_id = ? AND status = 'pending';`,
      [input.discardedAt, input.proposalId]
    );
    if (Number(update.changes) !== 1) throw new Error('PENDING_PROPOSAL_CONFLICT');
  });
}

export function pruneExpiredEditProposals(database: MediaLabDatabase, before: string): number {
  const result = database.run(
    `DELETE FROM pending_edit_proposals
     WHERE (status = 'pending' AND created_at < ?)
        OR (status IN ('confirmed', 'discarded')
          AND COALESCE(discarded_at, confirmed_at, created_at) < ?);`,
    [before, before]
  );
  return Number(result.changes);
}

export function restoreStoryboardVersion(
  database: MediaLabDatabase,
  input: RestoreStoryboardVersionInput
): AppliedStoryboardRevision {
  if (!input.projectId || !input.restoreId || !Number.isInteger(input.revision) || input.revision < 0) {
    throw new Error('INVALID_RESTORE_INPUT');
  }
  const operationId = `restore:${input.restoreId}`;

  return database.transaction(() => {
    if (database.all(
      'SELECT revision FROM storyboard_versions WHERE proposal_id = ?;',
      [operationId]
    )[0]) {
      throw new Error('RESTORE_ALREADY_APPLIED');
    }

    const target = database.all(
      `SELECT schema_version, payload FROM storyboard_versions
       WHERE project_id = ? AND revision = ?;`,
      [input.projectId, input.revision]
    )[0];
    if (!target) throw new Error('STORYBOARD_VERSION_NOT_FOUND');

    const current = database.all(
      `SELECT projects.id, projects.title, projects.created_at, storyboards.revision
       FROM projects JOIN storyboards ON storyboards.project_id = projects.id
       WHERE projects.id = ?;`,
      [input.projectId]
    )[0];
    if (!current) throw new Error('PROJECT_NOT_FOUND');

    const storyboard = StoryboardV1Schema.parse(JSON.parse(String(target.payload)));
    const currentRevision = Number(current.revision);
    const nextRevision = currentRevision + 1;
    database.run(
      `INSERT INTO storyboard_versions
        (project_id, revision, proposal_id, schema_version, payload, created_at)
       VALUES (?, ?, ?, ?, ?, ?);`,
      [input.projectId, nextRevision, operationId, Number(target.schema_version), String(target.payload), input.restoredAt]
    );
    const update = database.run(
      `UPDATE storyboards SET schema_version = ?, payload = ?, updated_at = ?, revision = ?
       WHERE project_id = ? AND revision = ?;`,
      [Number(target.schema_version), String(target.payload), input.restoredAt, nextRevision, input.projectId, currentRevision]
    );
    if (Number(update.changes) !== 1) throw new Error('STORYBOARD_REVISION_CONFLICT');

    return {
      project: {
        id: String(current.id),
        title: String(current.title),
        createdAt: String(current.created_at),
        revision: nextRevision,
        storyboard
      },
      revision: nextRevision
    };
  });
}
