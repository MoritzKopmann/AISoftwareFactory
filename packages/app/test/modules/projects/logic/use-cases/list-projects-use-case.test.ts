import { describe, expect, it } from 'vitest';
import { ListProjectsUseCase } from '../../../../../src/modules/projects/logic/use-cases/list-projects-use-case.js';
import { FakeContractPreflight, FakeProjectRepository } from '../../fakes/fake-projects-ports.js';

const failingReport = {
  passed: false,
  missingSlots: ['project-architecture'],
  missingHeadings: [],
  missingKeys: [],
};

describe('ListProjectsUseCase', () => {
  describe('execute', () => {
    it('should return every saved project with its freshly computed contract report', async () => {
      const projectRepository = new FakeProjectRepository();
      const contractPreflight = new FakeContractPreflight();
      const project = {
        id: 'moritz/aisf',
        repository: { owner: 'moritz', name: 'aisf' },
        checkoutPath: '/home/user/repo',
        addedAt: '2026-09-27T00:00:00.000Z',
      };
      await projectRepository.save(project);
      contractPreflight.setReport(project.checkoutPath, failingReport);
      const useCase = new ListProjectsUseCase(projectRepository, contractPreflight);

      expect(await useCase.execute()).toEqual([{ ...project, contract: failingReport }]);
      expect(contractPreflight.checkCalls).toEqual([project.checkoutPath]);
    });

    it('should return an empty list when nothing has been saved', async () => {
      const useCase = new ListProjectsUseCase(
        new FakeProjectRepository(),
        new FakeContractPreflight(),
      );

      expect(await useCase.execute()).toEqual([]);
    });

    it('should recompute the contract report on every call, with no re-add needed', async () => {
      const projectRepository = new FakeProjectRepository();
      const contractPreflight = new FakeContractPreflight();
      const project = {
        id: 'moritz/aisf',
        repository: { owner: 'moritz', name: 'aisf' },
        checkoutPath: '/home/user/repo',
        addedAt: '2026-09-27T00:00:00.000Z',
      };
      await projectRepository.save(project);
      contractPreflight.setReport(project.checkoutPath, failingReport);
      const useCase = new ListProjectsUseCase(projectRepository, contractPreflight);

      const [firstListing] = await useCase.execute();
      contractPreflight.setReport(project.checkoutPath, {
        passed: true,
        missingSlots: [],
        missingHeadings: [],
        missingKeys: [],
      });
      const [secondListing] = await useCase.execute();

      expect(firstListing?.contract).toEqual(failingReport);
      expect(secondListing?.contract).toEqual({
        passed: true,
        missingSlots: [],
        missingHeadings: [],
        missingKeys: [],
      });
    });
  });
});
