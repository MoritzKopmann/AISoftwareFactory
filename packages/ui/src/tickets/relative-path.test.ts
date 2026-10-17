import { describe, expect, it } from 'vitest';
import { relativePath } from './relative-path.js';

describe('relativePath', () => {
  it('should return the path below the root when the path is inside it', () => {
    expect(relativePath('/w/repo/7', '/w/repo/7/packages/ui/a.ts')).toBe('packages/ui/a.ts');
  });

  it('should return a dot when the path is the root', () => {
    expect(relativePath('/w/repo/7', '/w/repo/7')).toBe('.');
  });

  it('should use ../ segments when the path is outside the root', () => {
    expect(relativePath('/w/repo/7', '/w/plugins/x.md')).toBe('../../plugins/x.md');
  });

  it('should not treat a sibling with the same prefix as inside the root', () => {
    expect(relativePath('/w/repo/7', '/w/repo/70/a.ts')).toBe('../70/a.ts');
  });

  it('should return the path unchanged when it is not absolute', () => {
    expect(relativePath('/w/repo/7', 'src/a.ts')).toBe('src/a.ts');
  });

  it('should return the path unchanged when there is no root', () => {
    expect(relativePath(undefined, '/w/repo/7/a.ts')).toBe('/w/repo/7/a.ts');
  });
});
