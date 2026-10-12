import { describe, expect, it } from 'vitest';
import { ProjectsModuleRegisteredRepositories } from '../../../../../src/modules/tickets/infra/integrations/projects-module-registered-repositories.js';
import { FakeProjectsList } from '../../fakes/fake-projects-list.js';

const contract = { passed: true, missingSlots: [], missingHeadings: [], missingKeys: [] };

describe('ProjectsModuleRegisteredRepositories', () => {
  describe('list', () => {
    it('should return a project id and repository for each project when projects exist', async () => {
      const registeredRepositories = new ProjectsModuleRegisteredRepositories(
        new FakeProjectsList([
          {
            id: 'p1',
            repository: { owner: 'o', name: 'one' },
            checkoutPath: '/one',
            addedAt: '2026-10-12T00:00:00.000Z',
            contract,
          },
          {
            id: 'p2',
            repository: { owner: 'o', name: 'two' },
            checkoutPath: '/two',
            addedAt: '2026-10-12T00:00:00.000Z',
            contract,
          },
        ]),
      );

      expect(await registeredRepositories.list()).toEqual([
        { projectId: 'p1', repository: { owner: 'o', name: 'one' } },
        { projectId: 'p2', repository: { owner: 'o', name: 'two' } },
      ]);
    });
  });
});
