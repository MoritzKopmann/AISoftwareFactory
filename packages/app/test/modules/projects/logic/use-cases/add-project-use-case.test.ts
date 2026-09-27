import { describe, expect, it } from 'vitest';
import { ProjectAlreadyAddedError } from '../../../../../src/modules/projects/logic/errors/project-already-added-error.js';
import { AddProjectUseCase } from '../../../../../src/modules/projects/logic/use-cases/add-project-use-case.js';
import {
  FakeClock,
  FakeEventPublisher,
  FakeProjectRepository,
  FakeRepositoryResolver,
} from '../../fakes/fake-projects-ports.js';

const checkoutPath = '/home/user/repo';
const reference = { owner: 'moritz', name: 'aisf' };
const addedAt = '2026-09-27T00:00:00.000Z';

function createSubject() {
  const repositoryResolver = new FakeRepositoryResolver(reference);
  const projectRepository = new FakeProjectRepository();
  const clock = new FakeClock(addedAt);
  const events = new FakeEventPublisher();
  const useCase = new AddProjectUseCase({ repositoryResolver, projectRepository, clock, events });
  return { useCase, repositoryResolver, projectRepository, clock, events };
}

describe('AddProjectUseCase', () => {
  describe('execute', () => {
    it('should save the project with an id from the resolved repository', async () => {
      const { useCase, projectRepository } = createSubject();

      const project = await useCase.execute(checkoutPath);

      expect(project).toEqual({
        id: 'moritz/aisf',
        repository: reference,
        checkoutPath,
        addedAt,
      });
      expect(await projectRepository.findById('moritz/aisf')).toEqual(project);
    });

    it('should emit project.added when the project is saved', async () => {
      const { useCase, events } = createSubject();

      const project = await useCase.execute(checkoutPath);

      expect(events.emittedEvents).toEqual([
        {
          name: 'project.added',
          payload: {
            projectId: project.id,
            repository: project.repository,
            checkoutPath: project.checkoutPath,
          },
        },
      ]);
    });

    it('should throw ProjectAlreadyAddedError when the resolved repository is already saved', async () => {
      const { useCase, projectRepository } = createSubject();
      await projectRepository.save({
        id: 'moritz/aisf',
        repository: reference,
        checkoutPath: '/some/other/path',
        addedAt,
      });

      await expect(useCase.execute(checkoutPath)).rejects.toThrow(ProjectAlreadyAddedError);
    });

    it('should leave the project list unchanged when the repository is already added', async () => {
      const { useCase, projectRepository } = createSubject();
      await projectRepository.save({
        id: 'moritz/aisf',
        repository: reference,
        checkoutPath: '/some/other/path',
        addedAt,
      });

      await expect(useCase.execute(checkoutPath)).rejects.toThrow(ProjectAlreadyAddedError);

      expect(await projectRepository.list()).toHaveLength(1);
    });

    it('should propagate a resolver failure without saving or emitting', async () => {
      const { useCase, repositoryResolver, projectRepository, events } = createSubject();
      repositoryResolver.failure = new Error('not a checkout');

      await expect(useCase.execute(checkoutPath)).rejects.toThrow('not a checkout');

      expect(await projectRepository.list()).toEqual([]);
      expect(events.emittedEvents).toEqual([]);
    });
  });
});
