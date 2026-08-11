import { contextBridge, ipcRenderer } from 'electron';
import type { VpMediaApi } from '../shared/contracts';

const api: VpMediaApi = {
  settings: {
    get: () => ipcRenderer.invoke('vp-media:settings:get'),
    chooseLibrary: () => ipcRenderer.invoke('vp-media:settings:choose-library'),
    saveApiKey: (input) => ipcRenderer.invoke('vp-media:settings:save-api-key', input)
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
    get: (input) => ipcRenderer.invoke('vp-media:projects:get', input)
  },
  chat: { propose: (input) => ipcRenderer.invoke('vp-media:chat:propose', input) }
};

contextBridge.exposeInMainWorld('vpMedia', Object.freeze(api));
