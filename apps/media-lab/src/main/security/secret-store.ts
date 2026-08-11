import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { z } from 'zod';

const SecretNameSchema = z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/);
const SecretDocumentSchema = z.object({
  version: z.literal(1),
  secrets: z.record(z.string(), z.string())
}).strict();

export interface SafeStorageAdapter {
  isEncryptionAvailable(): boolean;
  encryptString(value: string): Buffer;
  decryptString(value: Buffer): string;
}

export interface SecretStore {
  save(name: string, value: string): Promise<void>;
  delete(name: string): Promise<void>;
  has(name: string): boolean;
  withSecret<T>(name: string, work: (value: string) => T | Promise<T>): Promise<T>;
  debugMetadata(): { version: 1; names: string[] };
}

interface CiphertextPersistence {
  persist(secrets: ReadonlyMap<string, string>): Promise<void>;
}

function createSecretStore(
  safeStorage: SafeStorageAdapter,
  initial: ReadonlyMap<string, string>,
  persistence: CiphertextPersistence
): SecretStore {
  const secrets = new Map(initial);
  return {
    save: async (untrustedName, untrustedValue) => {
      const name = SecretNameSchema.parse(untrustedName);
      if (!safeStorage.isEncryptionAvailable()) throw new Error('SECRET_STORAGE_UNAVAILABLE');
      const value = untrustedValue.trim();
      if (value.length < 12) throw new Error('INVALID_SECRET');
      const previous = secrets.get(name);
      secrets.set(name, safeStorage.encryptString(value).toString('base64'));
      try {
        await persistence.persist(secrets);
      } catch (error) {
        if (previous === undefined) secrets.delete(name);
        else secrets.set(name, previous);
        throw error;
      }
    },
    delete: async (untrustedName) => {
      const name = SecretNameSchema.parse(untrustedName);
      const previous = secrets.get(name);
      secrets.delete(name);
      try {
        await persistence.persist(secrets);
      } catch (error) {
        if (previous !== undefined) secrets.set(name, previous);
        throw error;
      }
    },
    has: (untrustedName) => secrets.has(SecretNameSchema.parse(untrustedName)),
    withSecret: async (untrustedName, work) => {
      const name = SecretNameSchema.parse(untrustedName);
      const encrypted = secrets.get(name);
      if (!encrypted) throw new Error('AI_NOT_CONFIGURED');
      if (!safeStorage.isEncryptionAvailable()) throw new Error('SECRET_STORAGE_UNAVAILABLE');
      const value = safeStorage.decryptString(Buffer.from(encrypted, 'base64'));
      return work(value);
    },
    debugMetadata: () => ({ version: 1, names: [...secrets.keys()].sort() })
  };
}

export function createMemoryBackedSecretStore(safeStorage: SafeStorageAdapter): SecretStore {
  return createSecretStore(safeStorage, new Map(), { persist: async () => undefined });
}

export async function createFileSecretStore(input: {
  filePath: string;
  safeStorage: SafeStorageAdapter;
}): Promise<SecretStore> {
  let document: z.infer<typeof SecretDocumentSchema> = { version: 1, secrets: {} };
  try {
    document = SecretDocumentSchema.parse(JSON.parse(await readFile(input.filePath, 'utf8')));
  } catch (error: unknown) {
    if (!(typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT')) throw error;
  }
  const partialPath = `${input.filePath}.partial`;
  const persistence: CiphertextPersistence = {
    persist: async (secrets) => {
      await mkdir(dirname(input.filePath), { recursive: true });
      const serialized = JSON.stringify({ version: 1, secrets: Object.fromEntries(secrets) });
      try {
        await writeFile(partialPath, serialized, { encoding: 'utf8', mode: 0o600 });
        await rename(partialPath, input.filePath);
      } catch (error) {
        await unlink(partialPath).catch(() => undefined);
        throw error;
      }
    }
  };
  return createSecretStore(input.safeStorage, new Map(Object.entries(document.secrets)), persistence);
}
