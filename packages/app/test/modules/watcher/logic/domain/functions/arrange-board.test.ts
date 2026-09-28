import { describe, expect, it } from 'vitest';
import { arrangeBoard } from '../../../../../../src/modules/watcher/logic/domain/functions/arrange-board.js';
import type { TicketSnapshot } from '../../../../../../src/modules/watcher/logic/domain/types/ticket-snapshot.js';
import { buildTicket } from '../../../fakes/build-ticket.js';

const emptySnapshot: TicketSnapshot = {
  takenAt: '2026-09-01T00:00:00Z',
  openTickets: [],
  recentlyClosedTickets: [],
  closedTotalCount: 0,
};

function rowTicketNumbers(board: ReturnType<typeof arrangeBoard>, key: string) {
  return board.rows.find((row) => row.key === key)?.tickets.map((ticket) => ticket.number);
}

describe('arrangeBoard', () => {
  it('should return all ten rows in lifecycle order without tickets when the snapshot is empty', () => {
    const board = arrangeBoard(emptySnapshot);

    expect(board.rows.map((row) => row.key)).toEqual([
      'idea',
      'backlog',
      'plan',
      'planned',
      'ready',
      'in-progress',
      'in-review',
      'stuck',
      'conflict',
      'closed',
    ]);
    expect(board.rows.every((row) => row.tickets.length === 0 && row.totalCount === 0)).toBe(true);
  });

  it('should put each open ticket in the row of its status', () => {
    const board = arrangeBoard({
      ...emptySnapshot,
      openTickets: [
        buildTicket({ number: 1, status: 'idea' }),
        buildTicket({ number: 2, status: 'ready' }),
      ],
    });

    expect(rowTicketNumbers(board, 'idea')).toEqual([1]);
    expect(rowTicketNumbers(board, 'ready')).toEqual([2]);
  });

  it('should sort a row newest first by updatedAt', () => {
    const board = arrangeBoard({
      ...emptySnapshot,
      openTickets: [
        buildTicket({ number: 1, status: 'ready', updatedAt: '2026-09-01T00:00:00Z' }),
        buildTicket({ number: 2, status: 'ready', updatedAt: '2026-09-03T00:00:00Z' }),
        buildTicket({ number: 3, status: 'ready', updatedAt: '2026-09-02T00:00:00Z' }),
      ],
    });

    expect(rowTicketNumbers(board, 'ready')).toEqual([2, 3, 1]);
  });

  it('should put a conflict ticket only in the Conflict row', () => {
    const board = arrangeBoard({
      ...emptySnapshot,
      openTickets: [
        buildTicket({
          number: 4,
          status: 'conflict',
          conflictingStatuses: ['ready', 'in-review'],
        }),
      ],
    });

    expect(rowTicketNumbers(board, 'conflict')).toEqual([4]);
    expect(rowTicketNumbers(board, 'ready')).toEqual([]);
    expect(rowTicketNumbers(board, 'in-review')).toEqual([]);
  });

  it('should show recently closed tickets with the total closed count in the Closed row', () => {
    const board = arrangeBoard({
      ...emptySnapshot,
      recentlyClosedTickets: [buildTicket({ number: 5, status: 'closed' })],
      closedTotalCount: 120,
    });

    const closedRow = board.rows.find((row) => row.key === 'closed');
    expect(closedRow?.tickets.map((ticket) => ticket.number)).toEqual([5]);
    expect(closedRow?.totalCount).toBe(120);
  });

  it('should count the tickets in a row as its total when the row is not Closed', () => {
    const board = arrangeBoard({
      ...emptySnapshot,
      openTickets: [
        buildTicket({ number: 1, status: 'stuck' }),
        buildTicket({ number: 2, status: 'stuck' }),
      ],
    });

    expect(board.rows.find((row) => row.key === 'stuck')?.totalCount).toBe(2);
  });
});
