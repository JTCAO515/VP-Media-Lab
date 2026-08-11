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
  }
];
