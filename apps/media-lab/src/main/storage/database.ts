import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import initSqlJs, { type Database, type SqlValue } from 'sql.js';

export interface Migration {
  id: string;
  sql: string;
}

export interface OpenDatabaseInput {
  filePath: string;
  migrations: Migration[];
}

export interface MediaLabDatabase {
  appliedMigrationIds(): string[];
  getSetting(key: string): string | null;
  setSetting(key: string, value: string): void;
  all(statement: string, parameters?: SqlValue[]): Array<Record<string, SqlValue>>;
  run(statement: string, parameters?: SqlValue[]): void;
  close(): Promise<void>;
}

async function readDatabase(filePath: string): Promise<Uint8Array | undefined> {
  try {
    return await readFile(filePath);
  } catch (error: unknown) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') return undefined;
    throw error;
  }
}

function checksum(sql: string): string {
  return createHash('sha256').update(sql).digest('hex');
}

function scalar(database: Database, statement: string, parameters: SqlValue[] = []): string | null {
  const result = database.exec(statement, parameters);
  if (result.length === 0 || result[0].values.length === 0) return null;
  return String(result[0].values[0][0]);
}

export async function openDatabase({ filePath, migrations }: OpenDatabaseInput): Promise<MediaLabDatabase> {
  const SQL = await initSqlJs();
  const bytes = await readDatabase(filePath);
  const database = new SQL.Database(bytes);
  database.run('PRAGMA foreign_keys = ON;');
  database.run('CREATE TABLE IF NOT EXISTS schema_migrations (id TEXT PRIMARY KEY, checksum TEXT NOT NULL);');

  database.run('BEGIN IMMEDIATE;');
  try {
    for (const migration of migrations) {
      const acceptedChecksum = scalar(database, 'SELECT checksum FROM schema_migrations WHERE id = ?;', [migration.id]);
      const nextChecksum = checksum(migration.sql);
      if (acceptedChecksum !== null && acceptedChecksum !== nextChecksum) {
        throw new Error(`Migration checksum changed: ${migration.id}`);
      }
      if (acceptedChecksum === null) {
        database.run(migration.sql);
        database.run('INSERT INTO schema_migrations (id, checksum) VALUES (?, ?);', [migration.id, nextChecksum]);
      }
    }
    database.run('COMMIT;');
  } catch (error) {
    database.run('ROLLBACK;');
    database.close();
    throw error;
  }

  return {
    appliedMigrationIds: () => database.exec('SELECT id FROM schema_migrations ORDER BY id;')[0]?.values.map(([id]) => String(id)) ?? [],
    getSetting: (key) => scalar(database, 'SELECT value FROM settings WHERE key = ?;', [key]),
    setSetting: (key, value) => database.run(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value;',
      [key, value]
    ),
    all: (statement, parameters = []) => {
      const result = database.exec(statement, parameters)[0];
      if (!result) return [];
      return result.values.map((values) => Object.fromEntries(result.columns.map((column, index) => [column, values[index]])));
    },
    run: (statement, parameters = []) => database.run(statement, parameters),
    close: async () => {
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, database.export());
      database.close();
    }
  };
}
