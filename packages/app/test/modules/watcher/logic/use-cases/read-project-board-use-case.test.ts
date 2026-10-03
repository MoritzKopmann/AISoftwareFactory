import { describe, expect, it } from 'vitest';
import type { RepositoryWatch } from '../../../../../src/modules/watcher/logic/domain/types/repository-watch.js';
import type { ActiveRunLookup } from '../../../../../src/modules/watcher/logic/ports/active-run-lookup.js';
import { ReadProjectBoardUseCase } from '../../../../../src/modules/watcher/logic/use-cases/read-project-board-use-case.js';

const watch: RepositoryWatch = {
  projectId: 'owner/name',
  repository: { owner: 'owner', name: 'name' },
  sync: { state: 'pending' },
};

function createSubject(runningTicketNumbers: ReadonlyArray<number>) {
  const requestedProjectIds: string[] = [];
  const activeRunLookup: ActiveRunLookup = {
    activeRunTicketNumbers: async (projectId) => {
      requestedProjectIds.push(projectId);
      return runningTicketNumbers;
    },
  };
  return { subject: new ReadProjectBoardUseCase({ activeRunLookup }), requestedProjectIds };
}

describe('ReadProjectBoardUseCase', () => {
  describe('execute', () => {
    it('should name every running ticket when the project has active runs', async () => {
      const { subject, requestedProjectIds } = createSubject([139, 140]);

      const projectBoard = await subject.execute(watch);

      expect(projectBoard).toEqual({
        projectId: 'owner/name',
        sync: { state: 'pending' },
        runningTicketNumbers: [139, 140],
      });
      expect(requestedProjectIds).toEqual(['owner/name']);
    });

    it('should name no running tickets when the project has no active run', async () => {
      const { subject } = createSubject([]);

      const projectBoard = await subject.execute(watch);

      expect(projectBoard).toEqual({
        projectId: 'owner/name',
        sync: { state: 'pending' },
        runningTicketNumbers: [],
      });
    });
  });
});
