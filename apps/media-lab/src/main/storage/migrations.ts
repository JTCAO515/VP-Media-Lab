import type { Migration } from './database';

export const mediaLabMigrations: Migration[] = [
  {
    id: '001_core',
    sql: `
      CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS media_assets (
        id TEXT PRIMARY KEY, asset_kind TEXT NOT NULL CHECK(asset_kind IN ('owned', 'reference')),
        name TEXT NOT NULL, path TEXT NOT NULL UNIQUE, content_hash TEXT NOT NULL,
        rights_status TEXT NOT NULL, created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS local_jobs (
        id TEXT PRIMARY KEY, kind TEXT NOT NULL, state TEXT NOT NULL, created_at TEXT NOT NULL
      );
    `
  },
  {
    id: '002_asset_locations',
    sql: `
      CREATE TABLE IF NOT EXISTS asset_locations (
        path TEXT PRIMARY KEY,
        asset_id TEXT NOT NULL REFERENCES media_assets(id) ON DELETE CASCADE,
        observed_at TEXT NOT NULL,
        missing_at TEXT NULL
      );
      CREATE INDEX IF NOT EXISTS asset_locations_asset_id_index ON asset_locations(asset_id);
      INSERT OR IGNORE INTO asset_locations (path, asset_id, observed_at, missing_at)
        SELECT path, id, created_at, NULL FROM media_assets;
    `
  },
  {
    id: '003_projects',
    sql: `
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS storyboards (
        project_id TEXT PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
        id TEXT NOT NULL UNIQUE,
        schema_version INTEGER NOT NULL,
        payload TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `
  },
  {
    id: '004_storyboard_versions',
    sql: `
      ALTER TABLE storyboards ADD COLUMN revision INTEGER NOT NULL DEFAULT 0;
      CREATE TABLE storyboard_versions (
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        revision INTEGER NOT NULL,
        proposal_id TEXT NULL,
        schema_version INTEGER NOT NULL,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY (project_id, revision),
        UNIQUE (project_id, proposal_id)
      );
      CREATE INDEX storyboard_versions_project_index ON storyboard_versions(project_id, revision);
    `
  },
  {
    id: '004b_global_proposal_ids',
    sql: `
      ALTER TABLE storyboard_versions ADD COLUMN legacy_proposal_id TEXT NULL;
      UPDATE storyboard_versions
        SET legacy_proposal_id = proposal_id, proposal_id = NULL
        WHERE proposal_id IS NOT NULL
          AND rowid NOT IN (
            SELECT MIN(rowid) FROM storyboard_versions
            WHERE proposal_id IS NOT NULL GROUP BY proposal_id
          );
    `
  },
  {
    id: '005_pending_edit_proposals',
    sql: `
      CREATE UNIQUE INDEX storyboard_versions_proposal_id_unique
        ON storyboard_versions(proposal_id) WHERE proposal_id IS NOT NULL;
      CREATE TABLE pending_edit_proposals (
        proposal_id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        base_revision INTEGER NOT NULL,
        payload TEXT NOT NULL,
        payload_hash TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('pending', 'confirmed')),
        created_at TEXT NOT NULL,
        confirmed_at TEXT NULL
      );
      CREATE INDEX pending_edit_proposals_project_index
        ON pending_edit_proposals(project_id, status, created_at);
    `
  },
  {
    id: '006_discarded_edit_proposals',
    sql: `
      CREATE TABLE pending_edit_proposals_v2 (
        proposal_id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        base_revision INTEGER NOT NULL,
        payload TEXT NOT NULL,
        payload_hash TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('pending', 'confirmed', 'discarded')),
        created_at TEXT NOT NULL,
        confirmed_at TEXT NULL,
        discarded_at TEXT NULL
      );
      INSERT INTO pending_edit_proposals_v2
        (proposal_id, project_id, base_revision, payload, payload_hash, status, created_at, confirmed_at, discarded_at)
        SELECT proposal_id, project_id, base_revision, payload, payload_hash, status, created_at, confirmed_at, NULL
        FROM pending_edit_proposals;
      DROP TABLE pending_edit_proposals;
      ALTER TABLE pending_edit_proposals_v2 RENAME TO pending_edit_proposals;
      CREATE INDEX pending_edit_proposals_project_index
        ON pending_edit_proposals(project_id, status, created_at);
    `
  },
  {
    id: '007_ai_usage_events',
    sql: `
      CREATE TABLE ai_usage_events (
        id TEXT PRIMARY KEY,
        project_id TEXT NULL REFERENCES projects(id) ON DELETE SET NULL,
        operation TEXT NOT NULL,
        provider TEXT NOT NULL,
        model TEXT NOT NULL,
        started_at TEXT NOT NULL,
        latency_ms INTEGER NOT NULL,
        input_tokens INTEGER NOT NULL,
        output_tokens INTEGER NOT NULL,
        total_tokens INTEGER NOT NULL,
        estimated_cost_micros INTEGER NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('succeeded', 'failed')),
        error_code TEXT NULL,
        retry_count INTEGER NOT NULL
      );
      CREATE INDEX ai_usage_events_started_index ON ai_usage_events(started_at);
      CREATE INDEX ai_usage_events_project_index ON ai_usage_events(project_id, started_at);
    `
  },
  {
    id: '008_guided_production',
    sql: `
      CREATE TABLE guide_templates (
        id TEXT NOT NULL,
        version INTEGER NOT NULL,
        schema_version INTEGER NOT NULL,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY (id, version)
      );
      CREATE TABLE guided_production_runs (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        template_id TEXT NOT NULL,
        template_version INTEGER NOT NULL,
        schema_version INTEGER NOT NULL,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (template_id, template_version) REFERENCES guide_templates(id, version)
      );
      CREATE INDEX guided_production_runs_project_index ON guided_production_runs(project_id, created_at DESC);
      CREATE TABLE guided_production_events (
        run_id TEXT NOT NULL REFERENCES guided_production_runs(id) ON DELETE CASCADE,
        sequence INTEGER NOT NULL,
        event_type TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY (run_id, sequence)
      );
    `
  },
  {
    id: '009_guided_production_integrity',
    sql: `
      CREATE TRIGGER guided_production_events_no_update
      BEFORE UPDATE ON guided_production_events
      BEGIN SELECT RAISE(ABORT, 'GUIDE_EVENTS_APPEND_ONLY'); END;
      CREATE TRIGGER guided_production_events_no_delete
      BEFORE DELETE ON guided_production_events
      BEGIN SELECT RAISE(ABORT, 'GUIDE_EVENTS_APPEND_ONLY'); END;
    `
  },
  {
    id: '010_guided_production_current_run',
    sql: `
      DROP TRIGGER guided_production_events_no_delete;
      ALTER TABLE guided_production_runs ADD COLUMN is_current INTEGER NOT NULL DEFAULT 0 CHECK(is_current IN (0, 1));
      UPDATE guided_production_runs
      SET is_current = 1
      WHERE id IN (
        SELECT id FROM (
          SELECT id, ROW_NUMBER() OVER (PARTITION BY project_id ORDER BY updated_at DESC, id DESC) AS position
          FROM guided_production_runs
        ) WHERE position = 1
      );
      CREATE UNIQUE INDEX guided_production_one_current_run_per_project
        ON guided_production_runs(project_id) WHERE is_current = 1;
    `
  }
];
