import { describe, expect, it } from 'vitest';
import { pruneStatusWrites } from '../../../../../../src/modules/watcher/logic/domain/functions/prune-status-writes.js';
import type { StatusWrite } from '../../../../../../src/modules/watcher/logic/domain/types/status-write.js';
import type { TicketSnapshot } from '../../../../../../src/modules/watcher/logic/domain/types/ticket-snapshot.js';
import type { TicketStatus } from '../../../../../../src/shared/ticket-status/ticket-status.js';
import { buildTicket } from '../../../fakes/build-ticket.js';

const writtenAt = '2026-09-28T12:00:00.000Z';
const write: StatusWrite = { ticketNumber: 12, from: 'in-progress', to: 'stuck', writtenAt };

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
      pruneStatusWrites([write], snapshotShowing('stuck'), '2026-09-28T12:00:10.000Z'),
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
});
