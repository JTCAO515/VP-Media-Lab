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
  jobs: { list: () => ipcRenderer.invoke('vp-media:jobs:list') }
};

contextBridge.exposeInMainWorld('vpMedia', Object.freeze(api));
