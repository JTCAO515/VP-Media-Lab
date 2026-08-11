import { contextBridge, ipcRenderer } from 'electron';
import type { VpMediaApi } from '../shared/contracts';

const api: VpMediaApi = {
  settings: {
    get: () => ipcRenderer.invoke('vp-media:settings:get'),
    chooseLibrary: () => ipcRenderer.invoke('vp-media:settings:choose-library'),
    saveApiKey: (input) => ipcRenderer.invoke('vp-media:settings:save-api-key', input),
    deleteApiKey: () => ipcRenderer.invoke('vp-media:settings:delete-api-key'),
    saveProviderConfig: (input) => ipcRenderer.invoke('vp-media:settings:save-provider-config', input),
    testConnection: () => ipcRenderer.invoke('vp-media:settings:test-connection')
  },
  assets: {
    chooseFiles: () => ipcRenderer.invoke('vp-media:assets:choose-files'),
    import: (input) => ipcRenderer.invoke('vp-media:assets:import', input),
    list: (input) => ipcRenderer.invoke('vp-media:assets:list', input)
  },
  jobs: { list: () => ipcRenderer.invoke('vp-media:jobs:list') },
  projects: {
    create: (input) => ipcRenderer.invoke('vp-media:projects:create', input),
    list: () => ipcRenderer.invoke('vp-media:projects:list'),
    get: (input) => ipcRenderer.invoke('vp-media:projects:get', input),
    restoreVersion: (input) => ipcRenderer.invoke('vp-media:projects:restore-version', input)
  },
  chat: {
    propose: (input) => ipcRenderer.invoke('vp-media:chat:propose', input),
    confirm: (input) => ipcRenderer.invoke('vp-media:chat:confirm', input),
    discard: (input) => ipcRenderer.invoke('vp-media:chat:discard', input)
  },
  guide: {
    getForProject: (input) => ipcRenderer.invoke('vp-media:guide:get-for-project', input),
    createForProject: (input) => ipcRenderer.invoke('vp-media:guide:create-for-project', input),
    transition: (input) => ipcRenderer.invoke('vp-media:guide:transition', input)
  }
};

contextBridge.exposeInMainWorld('vpMedia', Object.freeze(api));
