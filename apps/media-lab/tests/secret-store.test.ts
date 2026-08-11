import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFileSecretStore, createMemoryBackedSecretStore, type SafeStorageAdapter } from '../src/main/security/secret-store';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

function fakeSafeStorage(): SafeStorageAdapter {
  return {
    isEncryptionAvailable: () => true,
    encryptString: (value) => Buffer.from(`encrypted:${value}`, 'utf8'),
    decryptString: (value) => value.toString('utf8').replace(/^encrypted:/, '')
  };
}

describe('OS-protected secret store', () => {
  it('never returns plaintext in metadata and scopes decryption to a callback', async () => {
    const store = createMemoryBackedSecretStore(fakeSafeStorage());
    await store.save('model-studio', 'test-secret-value');

    await expect(store.withSecret('model-studio', async (value) => value.length)).resolves.toBe(17);
    expect(store.has('model-studio')).toBe(true);
    expect(JSON.stringify(store.debugMetadata())).not.toContain('test-secret-value');
    await store.delete('model-studio');
    expect(store.has('model-studio')).toBe(false);
    await expect(store.withSecret('model-studio', async () => true)).rejects.toThrow('AI_NOT_CONFIGURED');
  });

  it('atomically persists only ciphertext outside SQLite', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'vp-secret-store-'));
    temporaryDirectories.push(directory);
    const filePath = join(directory, 'secrets.json');
    const store = await createFileSecretStore({ filePath, safeStorage: fakeSafeStorage() });

    await store.save('model-studio', 'test-secret-value');

    const serialized = await readFile(filePath, 'utf8');
    expect(serialized).not.toContain('test-secret-value');
    expect(serialized).toContain('model-studio');
    await expect(readFile(`${filePath}.partial`, 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('refuses to save when OS encryption is unavailable', async () => {
    const store = createMemoryBackedSecretStore({
      ...fakeSafeStorage(),
      isEncryptionAvailable: () => false
    });
    await expect(store.save('model-studio', 'test-secret-value')).rejects.toThrow('SECRET_STORAGE_UNAVAILABLE');
  });
});
