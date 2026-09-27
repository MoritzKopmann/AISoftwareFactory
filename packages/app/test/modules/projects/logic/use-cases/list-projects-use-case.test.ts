import { describe, expect, it } from 'vitest';
import { ListProjectsUseCase } from '../../../../../src/modules/projects/logic/use-cases/list-projects-use-case.js';
import { FakeProjectRepository } from '../../fakes/fake-projects-ports.js';

describe('ListProjectsUseCase', () => {
  describe('execute', () => {
    it('should return every saved project', async () => {
      const projectRepository = new FakeProjectRepository();
      const project = {
        id: 'moritz/aisf',
        repository: { owner: 'moritz', name: 'aisf' },
        checkoutPath: '/home/user/repo',
        addedAt: '2026-09-27T00:00:00.000Z',
      };
      await projectRepository.save(project);
      const useCase = new ListProjectsUseCase(projectRepository);

      expect(await useCase.execute()).toEqual([project]);
    });

    it('should return an empty list when nothing has been saved', async () => {
      const useCase = new ListProjectsUseCase(new FakeProjectRepository());

      expect(await useCase.execute()).toEqual([]);
    });
  });
});
