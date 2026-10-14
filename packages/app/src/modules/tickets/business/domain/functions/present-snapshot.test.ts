import { describe, expect, it } from 'vitest';
import { presentSnapshot } from './present-snapshot.js';
import type { StatusWrite } from '../types/status-write.js';
import type { TicketSnapshot } from '../types/ticket-snapshot.js';
import type { Ticket } from '../types/ticket.js';

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

const write: StatusWrite = {
  ticketNumber: 12,
  from: 'in-progress',
  to: 'in-review',
  waiting: false,
  stuck: false,
  writtenAt: '2026-09-28T12:00:00.000Z',
};

function snapshotOf(...openTickets: ReturnType<typeof buildTicket>[]): TicketSnapshot {
  return {
    takenAt: '2026-09-28T11:59:00.000Z',
    openTickets,
    recentlyClosedTickets: [buildTicket({ number: 12, status: 'closed' })],
    closedTotalCount: 1,
  };
}

describe('presentSnapshot', () => {
  it('should show the written status when the snapshot still shows the from status', () => {
    const presented = presentSnapshot(
      snapshotOf(buildTicket({ number: 12, status: 'in-progress' })),
      [write],
    );

    expect(presented.openTickets[0]).toMatchObject({
      status: 'in-review',
      conflictingStatuses: [],
    });
  });

  it('should show the written status when the snapshot shows idea mid-swap', () => {
    const presented = presentSnapshot(snapshotOf(buildTicket({ number: 12, status: 'idea' })), [
      write,
    ]);

    expect(presented.openTickets[0]?.status).toBe('in-review');
  });

  it('should show the written status when the snapshot shows a conflict containing the to status', () => {
    const presented = presentSnapshot(
      snapshotOf(
        buildTicket({
          number: 12,
          status: 'conflict',
          conflictingStatuses: ['in-progress', 'in-review'],
        }),
      ),
      [write],
    );

    expect(presented.openTickets[0]).toMatchObject({
      status: 'in-review',
      conflictingStatuses: [],
    });
  });

  it('should leave the ticket alone when the snapshot shows another status', () => {
    const other = buildTicket({ number: 12, status: 'planned' });
    const bystander = buildTicket({ number: 13, status: 'in-progress' });

    const presented = presentSnapshot(snapshotOf(other, bystander), [write]);

    expect(presented.openTickets).toEqual([other, bystander]);
  });

  it('should leave recently closed tickets and snapshot metadata alone when a write applies', () => {
    const snapshot = snapshotOf(buildTicket({ number: 12, status: 'in-progress' }));

    const presented = presentSnapshot(snapshot, [write]);

    expect(presented.recentlyClosedTickets).toEqual(snapshot.recentlyClosedTickets);
    expect(presented.takenAt).toBe(snapshot.takenAt);
  });

  it('should show the written flags when the snapshot still shows the old flags on the same status', () => {
    const flagWrite: StatusWrite = {
      ...write,
      from: 'in-progress',
      to: 'in-progress',
      waiting: true,
    };

    const presented = presentSnapshot(
      snapshotOf(buildTicket({ number: 12, status: 'in-progress' })),
      [flagWrite],
    );

    expect(presented.openTickets[0]).toMatchObject({
      status: 'in-progress',
      waiting: true,
      stuck: false,
    });
  });
});
