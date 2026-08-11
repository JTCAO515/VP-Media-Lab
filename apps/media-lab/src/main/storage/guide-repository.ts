import {
  GuideEventSchema,
  GuidedProductionRunV1Schema,
  WorkflowTemplateV1Schema,
  resolveWorkflow,
  transitionGuideRun,
  type GuideEvent,
  type GuidedProductionRunV1,
  type WorkflowTemplateV1
} from '@visepanda/media-lab-domain';
import type { MediaLabDatabase } from './database';

export interface CreateGuideRunInput {
  id: string;
  projectId: string;
  template: WorkflowTemplateV1;
  projectFacts?: Record<string, string>;
  createdAt: string;
}

export interface TransitionStoredGuideRunInput {
  runId: string;
  event: GuideEvent;
}

export interface GuideRepository {
  create(input: CreateGuideRunInput): GuidedProductionRunV1;
  get(runId: string): GuidedProductionRunV1 | null;
  getForProject(projectId: string): GuidedProductionRunV1 | null;
  transition(input: TransitionStoredGuideRunInput): GuidedProductionRunV1;
}

function parseRun(payload: unknown): GuidedProductionRunV1 {
  return GuidedProductionRunV1Schema.parse(JSON.parse(String(payload)));
}

export function createGuideRun(database: MediaLabDatabase, input: CreateGuideRunInput): GuidedProductionRunV1 {
  const canonicalTemplate = WorkflowTemplateV1Schema.parse(input.template);
  const template = resolveWorkflow(canonicalTemplate, input.projectFacts ?? {});
  const run = GuidedProductionRunV1Schema.parse({
    schemaVersion: 1,
    id: input.id,
    projectId: input.projectId,
    templateId: template.id,
    templateVersion: template.version,
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
    steps: template.steps.map((step, index) => ({
      ...step,
      state: index === 0 ? 'active' : 'pending',
      confirmedAt: null,
      blockedReason: null,
      skippedReason: null
    }))
  });
  return database.transaction(() => {
    const project = database.all('SELECT id FROM projects WHERE id = ?;', [run.projectId])[0];
    if (!project) throw new Error('PROJECT_NOT_FOUND');
    if (database.all('SELECT id FROM guided_production_runs WHERE project_id = ? AND is_current = 1;', [run.projectId])[0]) {
      throw new Error('GUIDE_RUN_ALREADY_EXISTS');
    }
    const templatePayload = JSON.stringify(canonicalTemplate);
    const registeredTemplate = database.all(
      'SELECT payload FROM guide_templates WHERE id = ? AND version = ?;',
      [template.id, template.version]
    )[0];
    if (registeredTemplate && String(registeredTemplate.payload) !== templatePayload) throw new Error('GUIDE_TEMPLATE_VERSION_CONFLICT');
    if (!registeredTemplate) database.run(
      `INSERT INTO guide_templates (id, version, schema_version, payload, created_at)
       VALUES (?, ?, ?, ?, ?);`,
      [canonicalTemplate.id, canonicalTemplate.version, canonicalTemplate.schemaVersion, templatePayload, input.createdAt]
    );
    database.run(
      `INSERT INTO guided_production_runs
       (id, project_id, template_id, template_version, schema_version, payload, created_at, updated_at, is_current)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1);`,
      [run.id, run.projectId, run.templateId, run.templateVersion, run.schemaVersion, JSON.stringify(run), run.createdAt, run.updatedAt]
    );
    return run;
  });
}

export function getGuideRun(database: MediaLabDatabase, runId: string): GuidedProductionRunV1 | null {
  const row = database.all('SELECT payload FROM guided_production_runs WHERE id = ?;', [runId])[0];
  return row ? parseRun(row.payload) : null;
}

export function getGuideRunForProject(database: MediaLabDatabase, projectId: string): GuidedProductionRunV1 | null {
  const row = database.all(
    'SELECT payload FROM guided_production_runs WHERE project_id = ? AND is_current = 1 ORDER BY updated_at DESC, id DESC LIMIT 1;',
    [projectId]
  )[0];
  return row ? parseRun(row.payload) : null;
}

export function createSqliteGuideRepository(database: MediaLabDatabase): GuideRepository {
  return {
    create: (input) => createGuideRun(database, input),
    get: (runId) => getGuideRun(database, runId),
    getForProject: (projectId) => getGuideRunForProject(database, projectId),
    transition: (input) => transitionStoredGuideRun(database, input)
  };
}

export function transitionStoredGuideRun(database: MediaLabDatabase, input: TransitionStoredGuideRunInput): GuidedProductionRunV1 {
  const event = GuideEventSchema.parse(input.event);
  return database.transaction(() => {
    const row = database.all('SELECT payload FROM guided_production_runs WHERE id = ?;', [input.runId])[0];
    if (!row) throw new Error('GUIDE_RUN_NOT_FOUND');
    const next = transitionGuideRun(parseRun(row.payload), event);
    const sequence = Number(database.all(
      'SELECT COALESCE(MAX(sequence), 0) AS value FROM guided_production_events WHERE run_id = ?;',
      [next.id]
    )[0]?.value ?? 0) + 1;
    database.run(
      `INSERT INTO guided_production_events (run_id, sequence, event_type, payload, created_at)
       VALUES (?, ?, ?, ?, ?);`,
      [next.id, sequence, event.type, JSON.stringify(event), event.at]
    );
    const update = database.run(
      'UPDATE guided_production_runs SET payload = ?, updated_at = ? WHERE id = ?;',
      [JSON.stringify(next), next.updatedAt, next.id]
    );
    if (Number(update.changes) !== 1) throw new Error('GUIDE_RUN_CONFLICT');
    return next;
  });
}
