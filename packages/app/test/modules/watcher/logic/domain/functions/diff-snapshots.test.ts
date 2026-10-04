import { describe, expect, it } from 'vitest';
import { diffSnapshots } from '../../../../../../src/modules/watcher/logic/domain/functions/diff-snapshots.js';
import type { Ticket } from '../../../../../../src/modules/watcher/logic/domain/types/ticket.js';
import type { TicketSnapshot } from '../../../../../../src/modules/watcher/logic/domain/types/ticket-snapshot.js';
import { buildTicket } from '../../../fakes/build-ticket.js';

function snapshotOf(
  openTickets: ReadonlyArray<Ticket>,
  recentlyClosedTickets: ReadonlyArray<Ticket> = [],
): TicketSnapshot {
  return {
    takenAt: '2026-09-01T00:00:00Z',
    openTickets,
    recentlyClosedTickets,
    closedTotalCount: recentlyClosedTickets.length,
  };
}

describe('diffSnapshots', () => {
  it('should name every ticket as added when there is no previous snapshot', () => {
    const current = snapshotOf(
      [buildTicket({ number: 1 }), buildTicket({ number: 2 })],
      [buildTicket({ number: 3, status: 'closed' })],
    );

    expect(diffSnapshots(undefined, current)).toEqual({
      addedTicketNumbers: [1, 2, 3],
      changedTicketNumbers: [],
      removedTicketNumbers: [],
    });
  });

  it('should be empty when nothing differs', () => {
    const previous = snapshotOf([buildTicket({ number: 1, status: 'ready' })]);
    const current = snapshotOf([buildTicket({ number: 1, status: 'ready' })]);

    expect(diffSnapshots(previous, current)).toEqual({
      addedTicketNumbers: [],
      changedTicketNumbers: [],
      removedTicketNumbers: [],
    });
  });

  it('should name a ticket as changed when its status differs', () => {
    const previous = snapshotOf([buildTicket({ number: 1, status: 'ready' })]);
    const current = snapshotOf([buildTicket({ number: 1, status: 'in-progress' })]);

    expect(diffSnapshots(previous, current).changedTicketNumbers).toEqual([1]);
  });

  it('should name a ticket as changed when its types differ', () => {
    const previous = snapshotOf([buildTicket({ number: 1, types: [] })]);
    const current = snapshotOf([buildTicket({ number: 1, types: ['spike'] })]);

    expect(diffSnapshots(previous, current).changedTicketNumbers).toEqual([1]);
  });

  it('should name a ticket as changed when a nested field differs', () => {
    const previous = snapshotOf([buildTicket({ number: 1 })]);
    const current = snapshotOf([
      buildTicket({
        number: 1,
        blockedBy: [{ repository: 'owner/name', number: 9, open: true }],
      }),
    ]);

    expect(diffSnapshots(previous, current).changedTicketNumbers).toEqual([1]);
  });

  it('should name a ticket as changed when it moves from open to closed', () => {
    const previous = snapshotOf([buildTicket({ number: 1, status: 'in-review' })]);
    const current = snapshotOf([], [buildTicket({ number: 1, status: 'closed' })]);

    expect(diffSnapshots(previous, current)).toEqual({
      addedTicketNumbers: [],
      changedTicketNumbers: [1],
      removedTicketNumbers: [],
    });
  });

  it('should name each ticket in its list when one changed, one is new and one is gone', () => {
    const previous = snapshotOf([
      buildTicket({ number: 1, status: 'ready' }),
      buildTicket({ number: 2, status: 'plan' }),
    ]);
    const current = snapshotOf([
      buildTicket({ number: 1, status: 'in-progress' }),
      buildTicket({ number: 3, status: 'idea' }),
    ]);

    expect(diffSnapshots(previous, current)).toEqual({
      addedTicketNumbers: [3],
      changedTicketNumbers: [1],
      removedTicketNumbers: [2],
    });
  });

  it.each([
    ['approval', { approved: false }],
    ['checks', { checks: 'failing' }],
    ['head commit', { headCommit: 'b' }],
  ] as const)(
    'should name the ticket as changed when its closing pull request %s differs',
    (_field, difference) => {
      const approvedPullRequest = {
        number: 5,
        url: 'https://github.com/owner/name/pull/5',
        state: 'OPEN',
        approved: true,
        checks: 'passing',
        mergeable: 'mergeable',
        canBeRebased: true,
        headCommit: 'a',
      } as const;
      const previous = snapshotOf([
        buildTicket({ number: 1, closingPullRequests: [approvedPullRequest] }),
      ]);
      const current = snapshotOf([
        buildTicket({
          number: 1,
          closingPullRequests: [{ ...approvedPullRequest, ...difference }],
        }),
      ]);

      expect(diffSnapshots(previous, current).changedTicketNumbers).toEqual([1]);
    },
  );
});
