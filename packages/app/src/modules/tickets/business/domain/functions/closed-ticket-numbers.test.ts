import { describe, expect, it } from 'vitest';
import type { Ticket } from '../types/ticket.js';
import type { TicketSnapshot } from '../types/ticket-snapshot.js';
import { closedTicketNumbers } from './closed-ticket-numbers.js';

function buildTicket(overrides: Partial<Ticket> & Pick<Ticket, 'number'>): Ticket {
  return {
    title: `Ticket ${overrides.number}`,
    url: `https://github.com/owner/name/issues/${overrides.number}`,
    body: '',
    status: 'idea',
    conflictingStatuses: [],
    hitl: false,
    waiting: false,
    stuck: false,
    types: [],
    subIssueNumbers: [],
    blockedBy: [],
    closingPullRequests: [],
    updatedAt: '2026-09-01T00:00:00Z',
    ...overrides,
  };
}

function snapshotOf(...tickets: ReadonlyArray<Ticket>): TicketSnapshot {
  return {
    takenAt: '2026-09-28T12:00:00.000Z',
    openTickets: tickets.filter(({ status }) => status !== 'closed'),
    recentlyClosedTickets: tickets.filter(({ status }) => status === 'closed'),
    closedTotalCount: 0,
  };
}

describe('closedTicketNumbers', () => {
  it('should return the ticket when it changed from ready to closed', () => {
    const previous = snapshotOf(buildTicket({ number: 7, status: 'ready' }));
    const current = snapshotOf(buildTicket({ number: 7, status: 'closed' }));

    expect(closedTicketNumbers(previous, current)).toEqual([7]);
  });

  it('should return nothing when the ticket was already closed', () => {
    const previous = snapshotOf(buildTicket({ number: 7, status: 'closed' }));
    const current = snapshotOf(buildTicket({ number: 7, status: 'closed' }));

    expect(closedTicketNumbers(previous, current)).toEqual([]);
  });

  it('should return every closed ticket when there is no previous snapshot', () => {
    const current = snapshotOf(
      buildTicket({ number: 3, status: 'closed' }),
      buildTicket({ number: 4, status: 'closed' }),
      buildTicket({ number: 5, status: 'ready' }),
    );

    expect(closedTicketNumbers(undefined, current)).toEqual([3, 4]);
  });

  it('should return the ticket when it is new and already closed', () => {
    const previous = snapshotOf(buildTicket({ number: 1, status: 'ready' }));
    const current = snapshotOf(
      buildTicket({ number: 1, status: 'ready' }),
      buildTicket({ number: 9, status: 'closed' }),
    );

    expect(closedTicketNumbers(previous, current)).toEqual([9]);
  });

  it('should return nothing when the ticket changed to another open status', () => {
    const previous = snapshotOf(buildTicket({ number: 7, status: 'ready' }));
    const current = snapshotOf(buildTicket({ number: 7, status: 'in-progress' }));

    expect(closedTicketNumbers(previous, current)).toEqual([]);
  });
});
