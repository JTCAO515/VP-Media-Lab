import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';

export const mainBundledDependencies = ['@visepanda/media-lab-domain'];

export default defineConfig({
  main: { plugins: [externalizeDepsPlugin({ exclude: mainBundledDependencies })] },
  preload: { plugins: [externalizeDepsPlugin()] },
  renderer: { plugins: [react()] }
});
