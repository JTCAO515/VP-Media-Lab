import type { MediaLabDatabase } from './database';

export interface UpsertMediaAssetInput {
  id: string;
  assetKind: 'owned' | 'reference';
  name: string;
  path: string;
  contentHash: string;
  now: string;
}

export interface StoredMediaAsset {
  id: string;
  assetKind: 'owned' | 'reference';
  name: string;
  path: string;
  contentHash: string;
  rightsStatus: string;
  createdAt: string;
}

function toAsset(row: Record<string, unknown>): StoredMediaAsset {
  return {
    id: String(row.id),
    assetKind: row.asset_kind as 'owned' | 'reference',
    name: String(row.name),
    path: String(row.path),
    contentHash: String(row.content_hash),
    rightsStatus: String(row.rights_status),
    createdAt: String(row.created_at)
  };
}

export function upsertMediaAsset(database: MediaLabDatabase, input: UpsertMediaAssetInput): StoredMediaAsset {
  const duplicate = database.all(
    'SELECT id, asset_kind, name, path, content_hash, rights_status, created_at FROM media_assets WHERE asset_kind = ? AND content_hash = ?;',
    [input.assetKind, input.contentHash]
  )[0];
  if (duplicate) {
    const asset = toAsset(duplicate);
    database.run(
      'INSERT INTO asset_locations (path, asset_id, observed_at, missing_at) VALUES (?, ?, ?, NULL) ON CONFLICT(path) DO UPDATE SET observed_at = excluded.observed_at, missing_at = NULL;',
      [input.path, asset.id, input.now]
    );
    return asset;
  }

  const atPath = database.all(
    'SELECT id, content_hash FROM media_assets WHERE path = ?;', [input.path]
  )[0];
  if (atPath && String(atPath.content_hash) !== input.contentHash) throw new Error('ASSET_PATH_CONTENT_CHANGED');
  if (atPath) {
    return toAsset(database.all(
      'SELECT id, asset_kind, name, path, content_hash, rights_status, created_at FROM media_assets WHERE id = ?;', [String(atPath.id)]
    )[0]);
  }

  database.run(
    'INSERT INTO media_assets (id, asset_kind, name, path, content_hash, rights_status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?);',
    [input.id, input.assetKind, input.name, input.path, input.contentHash, 'unknown', input.now]
  );
  database.run(
    'INSERT INTO asset_locations (path, asset_id, observed_at, missing_at) VALUES (?, ?, ?, NULL);',
    [input.path, input.id, input.now]
  );
  return {
    id: input.id, assetKind: input.assetKind, name: input.name, path: input.path,
    contentHash: input.contentHash, rightsStatus: 'unknown', createdAt: input.now
  };
}
