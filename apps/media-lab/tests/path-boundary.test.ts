import { describe, expect, it } from 'vitest';
import { isPathWithin } from '../src/main/security/paths';

describe('path boundary', () => {
  it('accepts a child path and rejects a sibling with the same prefix', () => {
    expect(isPathWithin('C:\\library', 'C:\\library\\clip.mp4')).toBe(true);
    expect(isPathWithin('C:\\library', 'C:\\library-copy\\clip.mp4')).toBe(false);
  });

  it('rejects a path outside an allowed root', () => {
    expect(isPathWithin('C:\\library', 'C:\\Windows\\system32\\file.txt')).toBe(false);
  });
});
