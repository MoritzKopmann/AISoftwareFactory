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

  it('should return the ticket route when the hash is #/projects/owner/name/tickets/12', () => {
    expect(parseAppRoute('#/projects/o/n/tickets/12')).toEqual({
      kind: 'ticket',
      id: 'o/n',
      number: 12,
    });
  });

  it('should return the project route when the hash is #/projects/o/tickets', () => {
    expect(parseAppRoute('#/projects/o/tickets')).toEqual({ kind: 'project', id: 'o/tickets' });
  });

  it('should return home when the ticket number is 0', () => {
    expect(parseAppRoute('#/projects/o/n/tickets/0')).toEqual({ kind: 'home' });
  });

  it('should return home when the ticket number is not a number', () => {
    expect(parseAppRoute('#/projects/o/n/tickets/abc')).toEqual({ kind: 'home' });
  });

  it('should return home when the hash is an unrelated route', () => {
    expect(parseAppRoute('#/tickets/5')).toEqual({ kind: 'home' });
  });
});
