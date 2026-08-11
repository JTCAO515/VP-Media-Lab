import { createHash } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import {
  DatabaseSync,
  type SQLInputValue,
  type SQLOutputValue,
  type StatementResultingChanges
} from 'node:sqlite';

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
  all(statement: string, parameters?: SQLInputValue[]): Array<Record<string, SQLOutputValue>>;
  run(statement: string, parameters?: SQLInputValue[]): StatementResultingChanges;
  transaction<T>(work: () => T): T;
  close(): void;
}

function checksum(sql: string): string {
  return createHash('sha256').update(sql).digest('hex');
}

function scalar(database: DatabaseSync, statement: string, parameters: SQLInputValue[] = []): string | null {
  const row = database.prepare(statement).get(...parameters);
  if (!row) return null;
  const value = Object.values(row)[0];
  return value === null || value === undefined ? null : String(value);
}

export async function openDatabase({ filePath, migrations }: OpenDatabaseInput): Promise<MediaLabDatabase> {
  await mkdir(dirname(filePath), { recursive: true });
  const database = new DatabaseSync(filePath, {
    enableDoubleQuotedStringLiterals: false,
    enableForeignKeyConstraints: true,
    timeout: 5_000
  });
  let transactionDepth = 0;

  database.exec('PRAGMA journal_mode = WAL;');
  database.exec('PRAGMA synchronous = FULL;');
  database.exec('CREATE TABLE IF NOT EXISTS schema_migrations (id TEXT PRIMARY KEY, checksum TEXT NOT NULL);');

  database.exec('BEGIN IMMEDIATE;');
  try {
    for (const migration of migrations) {
      const acceptedChecksum = scalar(database, 'SELECT checksum FROM schema_migrations WHERE id = ?;', [migration.id]);
      const nextChecksum = checksum(migration.sql);
      if (acceptedChecksum !== null && acceptedChecksum !== nextChecksum) {
        throw new Error(`Migration checksum changed: ${migration.id}`);
      }
      if (acceptedChecksum === null) {
        database.exec(migration.sql);
        database.prepare('INSERT INTO schema_migrations (id, checksum) VALUES (?, ?);').run(migration.id, nextChecksum);
      }
    }
    database.exec('COMMIT;');
  } catch (error) {
    database.exec('ROLLBACK;');
    database.close();
    throw error;
  }

  const transaction = <T>(work: () => T): T => {
    if (transactionDepth > 0) {
      const savepoint = `vp_nested_${transactionDepth}`;
      database.exec(`SAVEPOINT ${savepoint};`);
      transactionDepth += 1;
      try {
        const result = work();
        database.exec(`RELEASE SAVEPOINT ${savepoint};`);
        return result;
      } catch (error) {
        database.exec(`ROLLBACK TO SAVEPOINT ${savepoint};`);
        database.exec(`RELEASE SAVEPOINT ${savepoint};`);
        throw error;
      } finally {
        transactionDepth -= 1;
      }
    }
    database.exec('BEGIN IMMEDIATE;');
    transactionDepth += 1;
    try {
      const result = work();
      database.exec('COMMIT;');
      return result;
    } catch (error) {
      database.exec('ROLLBACK;');
      throw error;
    } finally {
      transactionDepth -= 1;
    }
  };

  return {
    appliedMigrationIds: () => database.prepare('SELECT id FROM schema_migrations ORDER BY id;').all().map((row) => String(row.id)),
    getSetting: (key) => scalar(database, 'SELECT value FROM settings WHERE key = ?;', [key]),
    setSetting: (key, value) => {
      database.prepare(
        'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value;'
      ).run(key, value);
    },
    all: (statement, parameters = []) => database.prepare(statement).all(...parameters),
    run: (statement, parameters = []) => database.prepare(statement).run(...parameters),
    transaction,
    close: () => database.close()
  };
}
