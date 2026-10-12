import { describe, expect, it } from 'vitest';
import { ProjectsModuleProjectLookup } from '../../../../../src/modules/findings/infra/integrations/projects-module-project-lookup.js';
import { FakeProjectsFind } from '../../fakes/fake-projects-find.js';

const project = {
  id: 'p1',
  repository: { owner: 'owner', name: 'name' },
  checkoutPath: '/repo',
  addedAt: '2026-10-12T00:00:00.000Z',
  contract: { passed: true, missingSlots: [], missingHeadings: [], missingKeys: [] },
};

describe('ProjectsModuleProjectLookup', () => {
  describe('find', () => {
    it('should return the repository when the project is known', async () => {
      const lookup = new ProjectsModuleProjectLookup(new FakeProjectsFind([project]));

      expect(await lookup.find('p1')).toEqual({ repository: { owner: 'owner', name: 'name' } });
    });

    it('should return undefined when the project is unknown', async () => {
      const lookup = new ProjectsModuleProjectLookup(new FakeProjectsFind([project]));

      expect(await lookup.find('missing')).toBeUndefined();
    });
  });
});
