import { describe, expect, it } from 'vitest';
import { InMemoryWatchStore } from '../../../../../src/modules/watcher/infra/integrations/in-memory-watch-store.js';
import { ReadOpenTicketsUseCase } from '../../../../../src/modules/watcher/logic/use-cases/read-open-tickets-use-case.js';
import { buildTicket } from '../../fakes/build-ticket.js';

describe('ReadOpenTicketsUseCase', () => {
  it('should list the open tickets with unconfirmed status writes applied when the project is watched', () => {
    const watchStore = new InMemoryWatchStore();
    watchStore.saveWatch({
      projectId: 'octo/repo',
      repository: { owner: 'octo', name: 'repo' },
      sync: { state: 'ok', checkedAt: 'x', snapshotTakenAt: 'x' },
      snapshot: {
        takenAt: 'x',
        openTickets: [buildTicket({ number: 7, status: 'stuck' })],
        recentlyClosedTickets: [],
        closedTotalCount: 0,
      },
    });
    watchStore.saveStatusWrite('octo/repo', {
      ticketNumber: 7,
      from: 'stuck',
      to: 'ready',
      writtenAt: '2026-09-28T12:00:00.000Z',
    });

    const tickets = new ReadOpenTicketsUseCase({ watchStore }).execute('octo/repo');

    expect(tickets.map((ticket) => ticket.status)).toEqual(['ready']);
  });

  it('should list nothing when the project is unknown', () => {
    const useCase = new ReadOpenTicketsUseCase({ watchStore: new InMemoryWatchStore() });

    expect(useCase.execute('octo/none')).toEqual([]);
  });
});
