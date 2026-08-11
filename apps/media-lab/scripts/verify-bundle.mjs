import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const mainBundlePath = resolve('out/main/index.js');
const preloadBundlePath = resolve('out/preload/index.cjs');
const mainBundle = await readFile(mainBundlePath, 'utf8');
const preloadBundle = await readFile(preloadBundlePath, 'utf8');

if (mainBundle.includes('from "@visepanda/media-lab-domain"') || mainBundle.includes("from '@visepanda/media-lab-domain'")) {
  throw new Error('Workspace TypeScript domain package was left external in the Electron main bundle.');
}

await access(preloadBundlePath);
if (/^\s*import\s/m.test(preloadBundle)) {
  throw new Error('Sandboxed Electron preload must be CommonJS and cannot contain ESM imports.');
}
console.log('Verified Electron bundle boundaries.');
