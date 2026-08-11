import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';

export const mainBundledDependencies = ['@visepanda/media-lab-domain'];
export const preloadBundleFileName = 'index.cjs';

export default defineConfig({
  main: { plugins: [externalizeDepsPlugin({ exclude: mainBundledDependencies })] },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: { rollupOptions: { output: { format: 'cjs', entryFileNames: preloadBundleFileName } } }
  },
  renderer: { plugins: [react()] }
});
