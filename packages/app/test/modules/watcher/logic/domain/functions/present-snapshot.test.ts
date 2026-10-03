import { describe, expect, it } from 'vitest';
import { presentSnapshot } from '../../../../../../src/modules/watcher/logic/domain/functions/present-snapshot.js';
import type { StatusWrite } from '../../../../../../src/modules/watcher/logic/domain/types/status-write.js';
import type { TicketSnapshot } from '../../../../../../src/modules/watcher/logic/domain/types/ticket-snapshot.js';
import { buildTicket } from '../../../fakes/build-ticket.js';

const write: StatusWrite = {
  ticketNumber: 12,
  from: 'in-progress',
  to: 'stuck',
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

    expect(presented.openTickets[0]).toMatchObject({ status: 'stuck', conflictingStatuses: [] });
  });

  it('should show the written status when the snapshot shows idea mid-swap', () => {
    const presented = presentSnapshot(snapshotOf(buildTicket({ number: 12, status: 'idea' })), [
      write,
    ]);

    expect(presented.openTickets[0]?.status).toBe('stuck');
  });

  it('should show the written status when the snapshot shows a conflict containing the to status', () => {
    const presented = presentSnapshot(
      snapshotOf(
        buildTicket({
          number: 12,
          status: 'conflict',
          conflictingStatuses: ['in-progress', 'stuck'],
        }),
      ),
      [write],
    );

    expect(presented.openTickets[0]).toMatchObject({ status: 'stuck', conflictingStatuses: [] });
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
});
