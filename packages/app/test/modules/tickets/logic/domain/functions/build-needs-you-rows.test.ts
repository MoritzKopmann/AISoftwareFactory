import { describe, expect, it } from 'vitest';
import { buildNeedsYouRows } from '../../../../../../src/modules/tickets/logic/domain/functions/build-needs-you-rows.js';
import { buildTicket } from '../../../fakes/build-ticket.js';

describe('buildNeedsYouRows', () => {
  it('should return an answer-round row when a waiting ticket has a round wait', () => {
    const rows = buildNeedsYouRows(
      [buildTicket({ number: 5, title: 'Five', status: 'in-progress', waiting: true })],
      [{ ticketNumber: 5, kind: 'round', since: '2026-10-01T10:00:00Z' }],
    );

    expect(rows).toEqual([
      {
        ticketNumber: 5,
        title: 'Five',
        action: 'answer-round',
        since: '2026-10-01T10:00:00Z',
      },
    ]);
  });

  it('should return answer-question and allow-permission rows when waits are of those kinds', () => {
    const rows = buildNeedsYouRows(
      [buildTicket({ number: 6, waiting: true }), buildTicket({ number: 7, waiting: true })],
      [
        { ticketNumber: 6, kind: 'question', since: '2026-10-01T10:00:00Z' },
        { ticketNumber: 7, kind: 'permission', since: '2026-10-01T10:01:00Z' },
      ],
    );

    expect(rows.map((row) => [row.ticketNumber, row.action])).toEqual([
      [6, 'answer-question'],
      [7, 'allow-permission'],
    ]);
  });

  it('should return a decide-stuck row since the ticket update when the ticket is stuck', () => {
    const rows = buildNeedsYouRows(
      [buildTicket({ number: 8, stuck: true, updatedAt: '2026-10-01T08:00:00Z' })],
      [],
    );

    expect(rows.map((row) => [row.action, row.since])).toEqual([
      ['decide-stuck', '2026-10-01T08:00:00Z'],
    ]);
  });

  it('should return a review-pull-request row when the ticket is in review', () => {
    const rows = buildNeedsYouRows(
      [buildTicket({ number: 9, status: 'in-review', updatedAt: '2026-10-01T07:00:00Z' })],
      [],
    );

    expect(rows.map((row) => [row.ticketNumber, row.action, row.since])).toEqual([
      [9, 'review-pull-request', '2026-10-01T07:00:00Z'],
    ]);
  });

  it('should return one decide-stuck row when the ticket is both stuck and waiting', () => {
    const rows = buildNeedsYouRows(
      [buildTicket({ number: 8, stuck: true, waiting: true })],
      [{ ticketNumber: 8, kind: 'round', since: '2026-10-01T10:00:00Z' }],
    );

    expect(rows.map((row) => row.action)).toEqual(['decide-stuck']);
  });

  it('should return a wait row rather than a review row when an in-review ticket waits', () => {
    const rows = buildNeedsYouRows(
      [buildTicket({ number: 9, status: 'in-review', waiting: true })],
      [{ ticketNumber: 9, kind: 'question', since: '2026-10-01T10:00:00Z' }],
    );

    expect(rows.map((row) => row.action)).toEqual(['answer-question']);
  });

  it('should return no row when a ticket waits without a runner wait', () => {
    const rows = buildNeedsYouRows(
      [buildTicket({ number: 5, status: 'in-progress', waiting: true })],
      [],
    );

    expect(rows).toEqual([]);
  });

  it('should return no row when a wait belongs to a ticket without the waiting flag', () => {
    const rows = buildNeedsYouRows(
      [buildTicket({ number: 5, status: 'in-progress' })],
      [{ ticketNumber: 5, kind: 'round', since: '2026-10-01T10:00:00Z' }],
    );

    expect(rows).toEqual([]);
  });

  it('should order rows oldest first and break ties by ticket number when since differs', () => {
    const rows = buildNeedsYouRows(
      [
        buildTicket({ number: 3, stuck: true, updatedAt: '2026-10-01T10:00:00Z' }),
        buildTicket({ number: 2, stuck: true, updatedAt: '2026-10-01T10:00:00Z' }),
        buildTicket({ number: 4, stuck: true, updatedAt: '2026-10-01T09:00:00Z' }),
      ],
      [],
    );

    expect(rows.map((row) => row.ticketNumber)).toEqual([4, 2, 3]);
  });
});
