import { describe, expect, it } from 'vitest';
import { RandomUuidIdentifiers } from '../../../src/shared/identifiers/random-uuid-identifiers.js';

describe('RandomUuidIdentifiers', () => {
  it('should return a different uuid on every call', () => {
    const identifiers = new RandomUuidIdentifiers();

    const first = identifiers.next();
    const second = identifiers.next();

    expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(second).not.toBe(first);
  });
});
