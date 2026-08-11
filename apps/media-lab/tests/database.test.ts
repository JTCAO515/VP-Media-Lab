import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { openDatabase } from '../src/main/storage/database';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe('SQLite migrations', () => {
  it('applies each migration once and persists records across restart', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'vp-media-lab-'));
    temporaryDirectories.push(directory);
    const filePath = join(directory, 'media-lab.sqlite');
    const migrations = [{ id: '001_core', sql: 'CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);' }];

    const first = await openDatabase({ filePath, migrations });
    first.setSetting('library_mode', 'index');
    expect(first.appliedMigrationIds()).toEqual(['001_core']);
    await first.close();

    const reopened = await openDatabase({ filePath, migrations });
    expect(reopened.appliedMigrationIds()).toEqual(['001_core']);
    expect(reopened.getSetting('library_mode')).toBe('index');
    await reopened.close();
  });

  it('rejects a migration whose accepted SQL checksum changes', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'vp-media-lab-'));
    temporaryDirectories.push(directory);
    const filePath = join(directory, 'media-lab.sqlite');
    const first = await openDatabase({ filePath, migrations: [{ id: '001_core', sql: 'CREATE TABLE sample (id TEXT);' }] });
    await first.close();

    await expect(
      openDatabase({ filePath, migrations: [{ id: '001_core', sql: 'CREATE TABLE sample (id TEXT, changed TEXT);' }] })
    ).rejects.toThrow('Migration checksum changed');
  });
});
