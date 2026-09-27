import { describe, expect, it } from 'vitest';
import { parseAppRoute } from '../src/app-route.js';

describe('parseAppRoute', () => {
  it('should return home when the hash is empty', () => {
    expect(parseAppRoute('')).toEqual({ kind: 'home' });
  });

  it('should return add-project when the hash is #/projects/new', () => {
    expect(parseAppRoute('#/projects/new')).toEqual({ kind: 'add-project' });
  });

  it('should return the project route when the hash is #/projects/owner/name', () => {
    expect(parseAppRoute('#/projects/owner/name')).toEqual({
      kind: 'project',
      id: 'owner/name',
    });
  });

  it('should return home when the hash is an unrelated route', () => {
    expect(parseAppRoute('#/tickets/5')).toEqual({ kind: 'home' });
  });
});
