import { describe, expect, it } from 'vitest';
import { FakeIdeaCreation } from '../../testing/fake-tickets-ports.js';
import { IdeaCreationFailedError } from '../errors/idea-creation-failed-error.js';
import { IdeaService } from './idea-service.js';

const repository = { owner: 'owner', name: 'name' };

function createSubject() {
  const ideaCreation = new FakeIdeaCreation();
  const refreshed: Array<typeof repository> = [];
  const service = new IdeaService({
    ideaCreation,
    repositoryWatchService: {
      refresh: async (refreshedRepository) => {
        refreshed.push(refreshedRepository);
      },
    },
  });
  return { service, ideaCreation, refreshed };
}

describe('IdeaService', () => {
  describe('create', () => {
    it('should create the idea with its title and body and return its number when the repository is registered', async () => {
      const { service, ideaCreation } = createSubject();

      const number = await service.create(repository, { title: 'Export trips', body: '' });

      expect(number).toBe(12);
      expect(ideaCreation.created).toEqual([
        { repository, idea: { title: 'Export trips', body: '' } },
      ]);
    });

    it('should refresh the repository snapshot after the idea is created', async () => {
      const { service, refreshed } = createSubject();

      await service.create(repository, { title: 'Export trips', body: '' });

      expect(refreshed).toEqual([repository]);
    });

    it('should fail and skip the snapshot when the idea cannot be created', async () => {
      const { service, ideaCreation, refreshed } = createSubject();
      ideaCreation.failure = new IdeaCreationFailedError('rate limited');

      await expect(service.create(repository, { title: 'Export trips', body: '' })).rejects.toThrow(
        IdeaCreationFailedError,
      );
      expect(refreshed).toEqual([]);
    });
  });
});
