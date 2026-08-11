import { describe, expect, it } from 'vitest';
import { mainBundledDependencies } from '../electron.vite.config';

describe('Electron packaging boundary', () => {
  it('bundles TypeScript workspace packages that Electron cannot load as external source', () => {
    expect(mainBundledDependencies).toContain('@visepanda/media-lab-domain');
  });
});
