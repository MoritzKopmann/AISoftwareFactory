import { describe, expect, it } from 'vitest';
import { InMemoryWatchStore } from '../../../../../src/modules/tickets/infra/integrations/in-memory-watch-store.js';
import type { RunWait } from '../../../../../src/modules/tickets/logic/ports/run-wait-lookup.js';
import { ReadNeedsYouUseCase } from '../../../../../src/modules/tickets/logic/use-cases/read-needs-you-use-case.js';
import type { Ticket } from '../../../../../src/modules/tickets/logic/domain/types/ticket.js';
import { buildTicket } from '../../fakes/build-ticket.js';

function createSubject(openTickets: ReadonlyArray<Ticket>, waits: ReadonlyArray<RunWait>) {
  const watchStore = new InMemoryWatchStore();
  watchStore.saveWatch({
    projectId: 'octo/repo',
    repository: { owner: 'octo', name: 'repo' },
    sync: { state: 'ok', checkedAt: 'x', snapshotTakenAt: 'x' },
    snapshot: { takenAt: 'x', openTickets, recentlyClosedTickets: [], closedTotalCount: 0 },
  });
  const requestedProjectIds: string[] = [];
  const subject = new ReadNeedsYouUseCase({
    watchStore,
    runWaitLookup: {
      waitsOf: async (projectId) => {
        requestedProjectIds.push(projectId);
        return waits;
      },
    },
  });
  return { subject, watchStore, requestedProjectIds };
}

describe('ReadNeedsYouUseCase', () => {
  describe('execute', () => {
    it('should return the rows of the open tickets when the project is watched', async () => {
      const { subject, requestedProjectIds } = createSubject(
        [
          buildTicket({ number: 5, status: 'in-progress', waiting: true }),
          buildTicket({ number: 9, status: 'in-review', updatedAt: '2026-10-01T11:00:00Z' }),
        ],
        [{ ticketNumber: 5, kind: 'round', since: '2026-10-01T10:00:00Z' }],
      );

      const rows = await subject.execute('octo/repo');

      expect(rows?.map((row) => [row.ticketNumber, row.action])).toEqual([
        [5, 'answer-round'],
        [9, 'review-pull-request'],
      ]);
      expect(requestedProjectIds).toEqual(['octo/repo']);
    });

    it('should count a just-written waiting label when no poll has confirmed it', async () => {
      const { subject, watchStore } = createSubject(
        [buildTicket({ number: 5, status: 'in-progress' })],
        [{ ticketNumber: 5, kind: 'question', since: '2026-10-01T10:00:00Z' }],
      );
      watchStore.saveStatusWrite('octo/repo', {
        ticketNumber: 5,
        from: 'in-progress',
        to: 'in-progress',
        waiting: true,
        stuck: false,
        writtenAt: '2026-10-01T10:00:00Z',
      });

      const rows = await subject.execute('octo/repo');

      expect(rows?.map((row) => [row.ticketNumber, row.action])).toEqual([[5, 'answer-question']]);
    });

    it('should return no rows when the project has no snapshot yet', async () => {
      const watchStore = new InMemoryWatchStore();
      watchStore.saveWatch({
        projectId: 'octo/repo',
        repository: { owner: 'octo', name: 'repo' },
        sync: { state: 'pending' },
      });
      const subject = new ReadNeedsYouUseCase({
        watchStore,
        runWaitLookup: { waitsOf: async () => [] },
      });

      expect(await subject.execute('octo/repo')).toEqual([]);
    });

    it('should return undefined when the project is unknown', async () => {
      const { subject } = createSubject([], []);

      expect(await subject.execute('octo/none')).toBeUndefined();
    });
  });
});
