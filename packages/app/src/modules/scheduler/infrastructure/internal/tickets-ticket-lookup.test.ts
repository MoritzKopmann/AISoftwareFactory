import { describe, expect, it } from 'vitest';
import { FakeTicketsApi, buildTicketDto } from '../../testing/fake-scheduler-apis.js';
import { TicketsTicketLookup } from './tickets-ticket-lookup.js';

describe('TicketsTicketLookup', () => {
  it('should describe a ticket without sub-issues as a leaf with the snapshot time when it is found', async () => {
    const lookup = new TicketsTicketLookup(new FakeTicketsApi(buildTicketDto({ types: ['task'] })));

    expect(await lookup.find('moritz/aisf', 138)).toEqual({
      number: 138,
      title: 'Add login',
      status: 'ready',
      types: ['task'],
      isLeaf: true,
      hasOpenBlocker: false,
      subIssueNumbers: [],
      snapshotTakenAt: '2026-09-29T10:00:00.000Z',
    });
  });

  it('should flag an open blocker and sub-issues when the ticket has them', async () => {
    const ticket = buildTicketDto({
      subIssueNumbers: [9],
      blockedBy: [{ repository: 'moritz/aisf', number: 3, open: true }],
    });

    expect(
      await new TicketsTicketLookup(new FakeTicketsApi(ticket)).find('moritz/aisf', 138),
    ).toMatchObject({
      isLeaf: false,
      hasOpenBlocker: true,
      subIssueNumbers: [9],
    });
  });

  it('should return undefined when the ticket is unknown', async () => {
    const lookup = new TicketsTicketLookup(new FakeTicketsApi());

    expect(await lookup.find('moritz/aisf', 999)).toBeUndefined();
  });
});
