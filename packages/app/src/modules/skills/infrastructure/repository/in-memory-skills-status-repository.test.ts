import { describe, expect, it } from 'vitest';
import { InMemorySkillsStatusRepository } from './in-memory-skills-status-repository.js';

describe('InMemorySkillsStatusRepository', () => {
  it('should hold a pending status and no credentials when nothing is saved', () => {
    const store = new InMemorySkillsStatusRepository();

    expect(store.status()).toEqual({ state: 'pending' });
    expect(store.credentials()).toBeUndefined();
  });

  it('should return the saved status and credentials when both are saved', () => {
    const store = new InMemorySkillsStatusRepository();
    const credentials = { setEnvironmentVariables: ['A'], apiKeyHelperFiles: [] };

    store.save({ state: 'passed' }, credentials);

    expect(store.status()).toEqual({ state: 'passed' });
    expect(store.credentials()).toEqual(credentials);
  });
});
