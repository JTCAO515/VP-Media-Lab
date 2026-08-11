import { isAbsolute, relative, resolve } from 'node:path';

export function isPathWithin(root: string, candidate: string): boolean {
  const rootPath = resolve(root).toLowerCase();
  const candidatePath = resolve(candidate).toLowerCase();
  const pathFromRoot = relative(rootPath, candidatePath);
  return pathFromRoot === '' || (!pathFromRoot.startsWith('..') && !isAbsolute(pathFromRoot));
}
