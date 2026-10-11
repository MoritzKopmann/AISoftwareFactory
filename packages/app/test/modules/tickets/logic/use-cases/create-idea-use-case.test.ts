import { describe, expect, it } from 'vitest';
import { IdeaCreationFailedError } from '../../../../../src/modules/tickets/logic/errors/idea-creation-failed-error.js';
import { CreateIdeaUseCase } from '../../../../../src/modules/tickets/logic/use-cases/create-idea-use-case.js';
import { FakeIdeaCreation } from '../../fakes/fake-tickets-ports.js';

const repository = { owner: 'owner', name: 'name' };

function createSubject() {
  const ideaCreation = new FakeIdeaCreation();
  const refreshed: Array<typeof repository> = [];
  const refreshSnapshot = { failure: undefined as Error | undefined };
  const useCase = new CreateIdeaUseCase({
    ideaCreation,
    refreshSnapshot: async (refreshedRepository) => {
      refreshed.push(refreshedRepository);
      if (refreshSnapshot.failure !== undefined) {
        throw refreshSnapshot.failure;
      }
    },
  });
  return { useCase, ideaCreation, refreshed, refreshSnapshot };
}

describe('CreateIdeaUseCase', () => {
  describe('execute', () => {
    it('should create the idea with its title and body and return its number when the repository is registered', async () => {
      const { useCase, ideaCreation } = createSubject();

      const number = await useCase.execute(repository, { title: 'Export trips', body: '' });

      expect(number).toBe(12);
      expect(ideaCreation.created).toEqual([
        { repository, idea: { title: 'Export trips', body: '' } },
      ]);
    });

    it('should refresh the repository snapshot after the idea is created', async () => {
      const { useCase, refreshed } = createSubject();

      await useCase.execute(repository, { title: 'Export trips', body: '' });

      expect(refreshed).toEqual([repository]);
    });

    it('should still return the number when the fresh snapshot fails', async () => {
      const { useCase, refreshSnapshot } = createSubject();
      refreshSnapshot.failure = new Error('github down');

      const number = await useCase.execute(repository, { title: 'Export trips', body: '' });

      expect(number).toBe(12);
    });

    it('should fail and skip the snapshot when the idea cannot be created', async () => {
      const { useCase, ideaCreation, refreshed } = createSubject();
      ideaCreation.failure = new IdeaCreationFailedError('rate limited');

      await expect(
        useCase.execute(repository, { title: 'Export trips', body: '' }),
      ).rejects.toThrow(IdeaCreationFailedError);
      expect(refreshed).toEqual([]);
    });
  });
});
