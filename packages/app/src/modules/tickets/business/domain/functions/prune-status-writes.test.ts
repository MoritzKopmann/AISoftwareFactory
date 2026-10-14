import { describe, expect, it } from 'vitest';
import { pruneStatusWrites } from './prune-status-writes.js';
import type { StatusWrite } from '../types/status-write.js';
import type { TicketSnapshot } from '../types/ticket-snapshot.js';
import type { TicketStatus } from '../../../../../shared/ticket-status/ticket-status.js';
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

const writtenAt = '2026-09-28T12:00:00.000Z';
const write: StatusWrite = {
  ticketNumber: 12,
  from: 'in-progress',
  to: 'in-review',
  waiting: false,
  stuck: false,
  writtenAt,
};

function snapshotShowing(status: TicketStatus | undefined): TicketSnapshot {
  return {
    takenAt: writtenAt,
    openTickets: status === undefined ? [] : [buildTicket({ number: 12, status })],
    recentlyClosedTickets: [],
    closedTotalCount: 0,
  };
}

describe('pruneStatusWrites', () => {
  it('should keep the write when the snapshot still shows the from status', () => {
    expect(
      pruneStatusWrites([write], snapshotShowing('in-progress'), '2026-09-28T12:00:10.000Z'),
    ).toEqual([write]);
  });

  it('should keep the write when the snapshot shows idea mid-swap', () => {
    expect(pruneStatusWrites([write], snapshotShowing('idea'), '2026-09-28T12:00:10.000Z')).toEqual(
      [write],
    );
  });

  it('should drop the write when the snapshot shows the to status', () => {
    expect(
      pruneStatusWrites([write], snapshotShowing('in-review'), '2026-09-28T12:00:10.000Z'),
    ).toEqual([]);
  });

  it('should drop the write when the snapshot shows any other status', () => {
    expect(
      pruneStatusWrites([write], snapshotShowing('ready'), '2026-09-28T12:00:10.000Z'),
    ).toEqual([]);
  });

  it('should drop the write when the ticket is no longer open', () => {
    expect(
      pruneStatusWrites([write], snapshotShowing(undefined), '2026-09-28T12:00:10.000Z'),
    ).toEqual([]);
  });

  it('should drop the write when it is 60 s old', () => {
    expect(
      pruneStatusWrites([write], snapshotShowing('in-progress'), '2026-09-28T12:01:00.000Z'),
    ).toEqual([]);
  });

  it('should keep the write when it is 59 s old', () => {
    expect(
      pruneStatusWrites([write], snapshotShowing('in-progress'), '2026-09-28T12:00:59.000Z'),
    ).toEqual([write]);
  });

  describe('flag write', () => {
    const flagWrite: StatusWrite = {
      ticketNumber: 12,
      from: 'in-progress',
      to: 'in-progress',
      waiting: true,
      stuck: false,
      writtenAt,
    };
    const now = '2026-09-28T12:00:10.000Z';

    function snapshotWithFlags(waiting: boolean): TicketSnapshot {
      return {
        takenAt: writtenAt,
        openTickets: [buildTicket({ number: 12, status: 'in-progress', waiting })],
        recentlyClosedTickets: [],
        closedTotalCount: 0,
      };
    }

    it('should keep the write when the snapshot still shows the old flags', () => {
      expect(pruneStatusWrites([flagWrite], snapshotWithFlags(false), now)).toEqual([flagWrite]);
    });

    it('should drop the write when the snapshot shows the written flags', () => {
      expect(pruneStatusWrites([flagWrite], snapshotWithFlags(true), now)).toEqual([]);
    });
  });
});
