import { describe, expect, it } from 'vitest';
import { InMemorySkillsStatusStore } from '../../../../../src/modules/skills/infra/integrations/in-memory-skills-status-store.js';

describe('InMemorySkillsStatusStore', () => {
  it('should hold a pending status and no credentials when nothing is saved', () => {
    const store = new InMemorySkillsStatusStore();

    expect(store.status()).toEqual({ state: 'pending' });
    expect(store.credentials()).toBeUndefined();
  });

  it('should return the saved status and credentials when both are saved', () => {
    const store = new InMemorySkillsStatusStore();
    const credentials = { setEnvironmentVariables: ['A'], apiKeyHelperFiles: [] };

    store.save({ state: 'passed' }, credentials);

    expect(store.status()).toEqual({ state: 'passed' });
    expect(store.credentials()).toEqual(credentials);
  });
});
