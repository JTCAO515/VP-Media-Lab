import { describe, expect, it } from 'vitest';
import { mainBundledDependencies, preloadBundleFileName } from '../electron.vite.config';

describe('Electron packaging boundary', () => {
  it('bundles TypeScript workspace packages that Electron cannot load as external source', () => {
    expect(mainBundledDependencies).toContain('@visepanda/media-lab-domain');
  });

  it('uses a CommonJS preload bundle because sandboxed Electron preloads cannot execute ESM imports', () => {
    expect(preloadBundleFileName).toBe('index.cjs');
  });
});
