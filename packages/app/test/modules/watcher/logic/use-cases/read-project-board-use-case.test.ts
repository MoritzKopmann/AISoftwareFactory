import { describe, expect, it } from 'vitest';
import type { RepositoryWatch } from '../../../../../src/modules/watcher/logic/domain/types/repository-watch.js';
import type { ActiveRunLookup } from '../../../../../src/modules/watcher/logic/ports/active-run-lookup.js';
import { ReadProjectBoardUseCase } from '../../../../../src/modules/watcher/logic/use-cases/read-project-board-use-case.js';

const watch: RepositoryWatch = {
  projectId: 'owner/name',
  repository: { owner: 'owner', name: 'name' },
  sync: { state: 'pending' },
};

function createSubject(runningTicketNumber: number | undefined) {
  const requestedProjectIds: string[] = [];
  const activeRunLookup: ActiveRunLookup = {
    activeRunTicketNumber: async (projectId) => {
      requestedProjectIds.push(projectId);
      return runningTicketNumber;
    },
  };
  return { subject: new ReadProjectBoardUseCase({ activeRunLookup }), requestedProjectIds };
}

describe('ReadProjectBoardUseCase', () => {
  describe('execute', () => {
    it('should name the running ticket when the project has an active run', async () => {
      const { subject, requestedProjectIds } = createSubject(139);

      const projectBoard = await subject.execute(watch);

      expect(projectBoard).toEqual({
        projectId: 'owner/name',
        sync: { state: 'pending' },
        runningTicketNumber: 139,
      });
      expect(requestedProjectIds).toEqual(['owner/name']);
    });

    it('should leave runningTicketNumber out when the project has no active run', async () => {
      const { subject } = createSubject(undefined);

      const projectBoard = await subject.execute(watch);

      expect(projectBoard).toEqual({ projectId: 'owner/name', sync: { state: 'pending' } });
      expect(projectBoard).not.toHaveProperty('runningTicketNumber');
    });
  });
});
