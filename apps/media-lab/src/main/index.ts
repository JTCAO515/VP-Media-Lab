import { app, BrowserWindow, dialog, ipcMain, safeStorage, shell } from 'electron';
import { createHash, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import { openDatabase, type MediaLabDatabase } from './storage/database';
import { mediaLabMigrations } from './storage/migrations';
import { upsertMediaAsset } from './storage/asset-repository';
import { createProjectWithStoryboard, getProjectWithStoryboard } from './storage/project-repository';
import type { AssetKind, MediaAssetSummary, ProjectStoryboard, ProjectSummary, PublicSettings } from '../shared/contracts';

let database: MediaLabDatabase;

function hashFile(path: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(path);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.once('error', reject);
    stream.once('end', () => resolve(hash.digest('hex')));
  });
}

function publicSettings(): PublicSettings {
  return {
    libraryPath: database.getSetting('library_path'),
    aiKeyConfigured: database.getSetting('ai_key_encrypted') !== null,
    monthlyBudgetCents: Number(database.getSetting('monthly_budget_cents') ?? '0')
  };
}

function assetRows(assetKind: AssetKind): MediaAssetSummary[] {
  return database.all(
    'SELECT id, asset_kind, name, path, content_hash, rights_status, created_at FROM media_assets WHERE asset_kind = ? ORDER BY created_at DESC;',
    [assetKind]
  ).map((row) => ({
    id: String(row.id), assetKind: row.asset_kind as AssetKind, name: String(row.name), path: String(row.path),
    contentHash: String(row.content_hash), rightsStatus: String(row.rights_status), createdAt: String(row.created_at)
  }));
}

function projectRows(): ProjectSummary[] {
  return database.all('SELECT id, title, created_at FROM projects ORDER BY created_at DESC;').map((row) => ({
    id: String(row.id), title: String(row.title), createdAt: String(row.created_at)
  }));
}

function toProjectStoryboard(project: NonNullable<ReturnType<typeof getProjectWithStoryboard>>): ProjectStoryboard {
  return {
    id: project.id,
    title: project.title,
    createdAt: project.createdAt,
    storyboard: {
      schemaVersion: project.storyboard.schemaVersion,
      id: project.storyboard.id,
      projectId: project.storyboard.projectId,
      language: project.storyboard.language,
      beats: project.storyboard.beats.map((beat) => ({
        id: beat.id, order: beat.order, durationMs: beat.durationMs, purpose: beat.purpose,
        onScreenText: beat.onScreenText, selectedAssetId: beat.selectedAssetId
      }))
    }
  };
}

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 1040,
    minHeight: 700,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true
    }
  });

  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event) => event.preventDefault());
  if (process.env.ELECTRON_RENDERER_URL) window.loadURL(process.env.ELECTRON_RENDERER_URL);
  else window.loadFile(join(__dirname, '../renderer/index.html'));
  return window;
}

function registerIpc(): void {
  ipcMain.handle('vp-media:settings:get', () => publicSettings());
  ipcMain.handle('vp-media:settings:choose-library', async () => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] });
    if (result.canceled || result.filePaths.length === 0) return null;
    database.setSetting('library_path', result.filePaths[0]);
    return result.filePaths[0];
  });
  ipcMain.handle('vp-media:settings:save-api-key', (_event, input: { value: string }) => {
    if (typeof input?.value !== 'string' || input.value.trim().length < 12) throw new Error('INVALID_INPUT');
    if (!safeStorage.isEncryptionAvailable()) throw new Error('SECRET_STORAGE_UNAVAILABLE');
    const encrypted = safeStorage.encryptString(input.value.trim()).toString('base64');
    database.setSetting('ai_key_encrypted', encrypted);
    return { configured: true };
  });
  ipcMain.handle('vp-media:assets:choose-files', async () => {
    const result = await dialog.showOpenDialog({ properties: ['openFile', 'multiSelections'], filters: [{ name: 'Media', extensions: ['mp4', 'mov', 'mkv', 'webm', 'mp3', 'wav', 'm4a', 'jpg', 'jpeg', 'png', 'webp'] }] });
    return result.canceled ? [] : result.filePaths;
  });
  ipcMain.handle('vp-media:assets:import', async (_event, input: { paths: string[]; assetKind: AssetKind }) => {
    if (!input || !Array.isArray(input.paths) || !['owned', 'reference'].includes(input.assetKind)) throw new Error('INVALID_INPUT');
    const imported: MediaAssetSummary[] = [];
    for (const path of input.paths) {
      const file = await stat(path);
      if (!file.isFile()) continue;
      const contentHash = await hashFile(path);
      const now = new Date().toISOString();
      const name = path.split(/[\\/]/).pop() ?? 'untitled';
      const asset = upsertMediaAsset(database, { id: randomUUID(), assetKind: input.assetKind, name, path, contentHash, now });
      imported.push(asset);
    }
    return imported;
  });
  ipcMain.handle('vp-media:assets:list', (_event, input: { assetKind: AssetKind }) => {
    if (!input || !['owned', 'reference'].includes(input.assetKind)) throw new Error('INVALID_INPUT');
    return assetRows(input.assetKind);
  });
  ipcMain.handle('vp-media:jobs:list', () => database.all('SELECT id, kind, state, created_at FROM local_jobs ORDER BY created_at DESC;').map((row) => ({
    id: String(row.id), kind: String(row.kind), state: String(row.state), createdAt: String(row.created_at)
  })));
  ipcMain.handle('vp-media:projects:create', (_event, input: { title: string; language: 'en' | 'zh' | 'other' }) => {
    if (!input || typeof input.title !== 'string' || !['en', 'zh', 'other'].includes(input.language) || input.title.trim().length < 3 || input.title.trim().length > 120) {
      throw new Error('INVALID_INPUT');
    }
    const projectId = randomUUID();
    const now = new Date().toISOString();
    const project = createProjectWithStoryboard(database, {
      id: projectId, title: input.title.trim(), createdAt: now,
      storyboard: {
        schemaVersion: 1, id: randomUUID(), projectId, evidencePackId: null, language: input.language,
        beats: [{
          id: randomUUID(), order: 0, durationMs: 5_000, purpose: 'opening beat', originalScript: '', onScreenText: '',
          sourceFactIds: [], candidateAssetIds: [], selectedAssetId: null, renderStatus: 'draft'
        }],
        factualReview: 'not_required', originalityReview: 'required'
      }
    });
    return { id: project.id, title: project.title, createdAt: project.createdAt };
  });
  ipcMain.handle('vp-media:projects:list', () => projectRows());
  ipcMain.handle('vp-media:projects:get', (_event, input: { id: string }) => {
    if (!input || typeof input.id !== 'string' || input.id.length === 0) throw new Error('INVALID_INPUT');
    const project = getProjectWithStoryboard(database, input.id);
    return project ? toProjectStoryboard(project) : null;
  });
  ipcMain.handle('vp-media:open-path', async (_event, path: string) => shell.openPath(path));
}

app.whenReady().then(async () => {
  database = await openDatabase({ filePath: join(app.getPath('userData'), 'media-lab.sqlite'), migrations: mediaLabMigrations });
  registerIpc();
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('before-quit', () => database?.close());
