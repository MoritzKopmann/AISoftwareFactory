import { describe, expect, it } from 'vitest';
import { FindProjectUseCase } from '../../../../../src/modules/projects/logic/use-cases/find-project-use-case.js';
import { FakeContractPreflight, FakeProjectRepository } from '../../fakes/fake-projects-ports.js';

const report = {
  passed: false,
  missingSlots: ['project-architecture'],
  missingHeadings: [],
  missingKeys: [],
};

describe('FindProjectUseCase', () => {
  describe('execute', () => {
    it('should return the project with its contract report when the id is known', async () => {
      const projectRepository = new FakeProjectRepository();
      const contractPreflight = new FakeContractPreflight();
      const project = {
        id: 'p1',
        repository: { owner: 'moritz', name: 'aisf' },
        checkoutPath: '/repo-one',
        addedAt: '2026-09-27T00:00:00.000Z',
      };
      await projectRepository.save(project);
      await projectRepository.save({ ...project, id: 'p2', checkoutPath: '/repo-two' });
      contractPreflight.setReport('/repo-one', report);
      const useCase = new FindProjectUseCase(projectRepository, contractPreflight);

      expect(await useCase.execute('p1')).toEqual({ ...project, contract: report });
      expect(contractPreflight.checkCalls).toEqual(['/repo-one']);
    });

    it('should return undefined when the id is unknown', async () => {
      const useCase = new FindProjectUseCase(
        new FakeProjectRepository(),
        new FakeContractPreflight(),
      );

      expect(await useCase.execute('missing')).toBeUndefined();
    });
  });
});
