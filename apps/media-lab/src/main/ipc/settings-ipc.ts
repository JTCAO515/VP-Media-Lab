import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { Dialog, IpcMain } from 'electron';
import type { MediaLabDatabase } from '../storage/database';
import { DefaultProviderConfig, ProviderConfigSchema, type ProviderConfig } from '../providers/provider-config';
import { QwenEditProvider, type ProviderConnectionExecution } from '../providers/qwen-edit-provider';
import type { SafeStorageAdapter, SecretStore } from '../security/secret-store';
import type { PublicSettings } from '../../shared/contracts';

const SaveApiKeyInputSchema = z.object({ value: z.string().trim().min(12).max(4_096) }).strict();

export interface PublicProviderConnectionResult {
  ok: boolean;
  model: string;
  latencyMs: number;
  errorCode: string | null;
}

interface ConnectionProvider {
  testConnection(): Promise<ProviderConnectionExecution>;
}

export interface TestProviderConnectionInput {
  database: MediaLabDatabase;
  secretStore: SecretStore;
  providerConfig: ProviderConfig;
  providerFactory?: (input: { apiKey: string; endpoint: string; region: string }) => ConnectionProvider;
  idFactory: () => string;
  now: () => string;
}

export async function testProviderConnection(input: TestProviderConnectionInput): Promise<PublicProviderConnectionResult> {
  const config = ProviderConfigSchema.parse(input.providerConfig);
  const startedAt = input.now();
  const execution = await input.secretStore.withSecret('model-studio', async (apiKey) => {
    const provider = (input.providerFactory ?? ((providerInput) => new QwenEditProvider(providerInput)))({
      apiKey,
      endpoint: config.baseUrl,
      region: config.region
    });
    return provider.testConnection();
  });
  input.database.run(
    `INSERT INTO ai_usage_events
      (id, project_id, operation, provider, model, started_at, latency_ms, input_tokens,
       output_tokens, total_tokens, estimated_cost_micros, status, error_code, retry_count)
     VALUES (?, NULL, 'connection_test', 'alibaba-model-studio', ?, ?, ?, ?, ?, ?, 0, ?, ?, 0);`,
    [
      input.idFactory(),
      execution.model,
      startedAt,
      execution.latencyMs,
      execution.inputTokens,
      execution.outputTokens,
      execution.totalTokens,
      execution.ok ? 'succeeded' : 'failed',
      execution.errorCode
    ]
  );
  return {
    ok: execution.ok,
    model: execution.model,
    latencyMs: execution.latencyMs,
    errorCode: execution.errorCode
  };
}

export function readProviderConfig(database: MediaLabDatabase): ProviderConfig {
  return ProviderConfigSchema.parse({
    baseUrl: database.getSetting('provider_base_url') ?? DefaultProviderConfig.baseUrl,
    region: database.getSetting('provider_region') ?? DefaultProviderConfig.region
  });
}

export async function migrateLegacyDatabaseSecret(input: {
  database: MediaLabDatabase;
  secretStore: SecretStore;
  safeStorage: SafeStorageAdapter;
}): Promise<void> {
  const legacyCiphertext = input.database.getSetting('ai_key_encrypted');
  if (!legacyCiphertext) return;
  if (!input.secretStore.has('model-studio')) {
    if (!input.safeStorage.isEncryptionAvailable()) throw new Error('SECRET_STORAGE_UNAVAILABLE');
    const legacySecret = input.safeStorage.decryptString(Buffer.from(legacyCiphertext, 'base64'));
    await input.secretStore.save('model-studio', legacySecret);
  }
  input.database.deleteSetting('ai_key_encrypted');
}

export function readPublicSettings(database: MediaLabDatabase, secretStore: SecretStore): PublicSettings {
  const provider = readProviderConfig(database);
  return {
    libraryPath: database.getSetting('library_path'),
    aiKeyConfigured: secretStore.has('model-studio'),
    monthlyBudgetCents: Number(database.getSetting('monthly_budget_cents') ?? '0'),
    providerBaseUrl: provider.baseUrl,
    providerRegion: provider.region
  };
}

export function registerSettingsIpc(input: {
  ipcMain: IpcMain;
  dialog: Dialog;
  database: MediaLabDatabase;
  secretStore: SecretStore;
}): void {
  input.ipcMain.handle('vp-media:settings:get', () => readPublicSettings(input.database, input.secretStore));
  input.ipcMain.handle('vp-media:settings:choose-library', async () => {
    const result = await input.dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] });
    if (result.canceled || result.filePaths.length === 0) return null;
    input.database.setSetting('library_path', result.filePaths[0]);
    return result.filePaths[0];
  });
  input.ipcMain.handle('vp-media:settings:save-api-key', async (_event, untrustedInput: unknown) => {
    const secret = SaveApiKeyInputSchema.parse(untrustedInput);
    await input.secretStore.save('model-studio', secret.value);
    return { configured: true };
  });
  input.ipcMain.handle('vp-media:settings:delete-api-key', async () => {
    await input.secretStore.delete('model-studio');
    return { configured: false as const };
  });
  input.ipcMain.handle('vp-media:settings:save-provider-config', (_event, untrustedInput: unknown) => {
    const config = ProviderConfigSchema.parse(untrustedInput);
    input.database.transaction(() => {
      input.database.setSetting('provider_base_url', config.baseUrl);
      input.database.setSetting('provider_region', config.region);
    });
    return readPublicSettings(input.database, input.secretStore);
  });
  input.ipcMain.handle('vp-media:settings:test-connection', () => testProviderConnection({
    database: input.database,
    secretStore: input.secretStore,
    providerConfig: readProviderConfig(input.database),
    idFactory: randomUUID,
    now: () => new Date().toISOString()
  }));
}
