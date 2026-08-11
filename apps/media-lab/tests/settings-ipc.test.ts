import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createMemoryBackedSecretStore } from '../src/main/security/secret-store';
import { openDatabase } from '../src/main/storage/database';
import { mediaLabMigrations } from '../src/main/storage/migrations';
import { migrateLegacyDatabaseSecret, testProviderConnection } from '../src/main/ipc/settings-ipc';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe('settings provider connection service', () => {
  it('moves a legacy encrypted key out of SQLite before deleting the database copy', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'vp-settings-'));
    temporaryDirectories.push(directory);
    const database = await openDatabase({ filePath: join(directory, 'media-lab.sqlite'), migrations: mediaLabMigrations });
    const safeStorage = {
      isEncryptionAvailable: () => true,
      encryptString: (value: string) => Buffer.from(`protected:${value}`),
      decryptString: (value: Buffer) => value.toString().replace(/^protected:/, '')
    };
    const secretStore = createMemoryBackedSecretStore(safeStorage);
    database.setSetting('ai_key_encrypted', safeStorage.encryptString('legacy-secret-value').toString('base64'));

    await migrateLegacyDatabaseSecret({ database, secretStore, safeStorage });

    expect(database.getSetting('ai_key_encrypted')).toBeNull();
    await expect(secretStore.withSecret('model-studio', (value) => value)).resolves.toBe('legacy-secret-value');
    database.close();
  });

  it('uses the secret only inside main and records a bounded usage event', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'vp-settings-'));
    temporaryDirectories.push(directory);
    const database = await openDatabase({ filePath: join(directory, 'media-lab.sqlite'), migrations: mediaLabMigrations });
    const secretStore = createMemoryBackedSecretStore({
      isEncryptionAvailable: () => true,
      encryptString: (value) => Buffer.from(`protected:${value}`),
      decryptString: (value) => value.toString().replace(/^protected:/, '')
    });
    await secretStore.save('model-studio', 'test-secret-value');
    const providerFactory = vi.fn(({ apiKey }: { apiKey: string; endpoint: string }) => {
      expect(apiKey).toBe('test-secret-value');
      return {
        testConnection: async () => ({
          ok: true, model: 'qwen-flash', latencyMs: 42, errorCode: null,
          inputTokens: 3, outputTokens: 1, totalTokens: 4
        })
      };
    });

    const result = await testProviderConnection({
      database,
      secretStore,
      providerConfig: { baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', region: 'cn-beijing' },
      providerFactory,
      idFactory: () => 'usage-1',
      now: () => '2026-08-11T00:00:00.000Z'
    });

    expect(result).toEqual({ ok: true, model: 'qwen-flash', latencyMs: 42, errorCode: null });
    const usage = database.all('SELECT operation, model, input_tokens, output_tokens, status, error_code FROM ai_usage_events;');
    expect(usage).toEqual([{
      operation: 'connection_test', model: 'qwen-flash', input_tokens: 3,
      output_tokens: 1, status: 'succeeded', error_code: null
    }]);
    expect(JSON.stringify(usage)).not.toContain('test-secret-value');
    expect(providerFactory).toHaveBeenCalledOnce();
    database.close();
  });
});
