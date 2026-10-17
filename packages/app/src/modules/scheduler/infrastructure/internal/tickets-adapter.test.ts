import { describe, expect, it } from 'vitest';
import { ConflictError } from '../../../../shared/errors.js';
import { RunNotAnswerableError } from '../../business/errors/run-not-answerable-error.js';
import { FakeTicketsApi, buildTicketDto } from '../../testing/fake-scheduler-apis.js';
import { TicketsAdapter } from './tickets-adapter.js';

describe('TicketsAdapter', () => {
  describe('find', () => {
    it('should describe a ticket without sub-issues as a leaf with the snapshot time when it is found', async () => {
      const adapter = new TicketsAdapter(new FakeTicketsApi(buildTicketDto({ types: ['task'] })));

      expect(await adapter.find('moritz/aisf', 138)).toEqual({
        number: 138,
        title: 'Add login',
        status: 'ready',
        types: ['task'],
        isLeaf: true,
        hasOpenBlocker: false,
        stuck: false,
        waiting: false,
        syncFailed: false,
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
        await new TicketsAdapter(new FakeTicketsApi(ticket)).find('moritz/aisf', 138),
      ).toMatchObject({
        isLeaf: false,
        hasOpenBlocker: true,
        subIssueNumbers: [9],
      });
    });

    it('should flag stuck and not waiting when the ticket is stuck', async () => {
      const adapter = new TicketsAdapter(
        new FakeTicketsApi(buildTicketDto({ number: 7, stuck: true, waiting: false })),
      );

      expect(await adapter.find('moritz/aisf', 7)).toMatchObject({ stuck: true, waiting: false });
    });

    it('should flag syncFailed when the sync state is failed', async () => {
      const tickets = new FakeTicketsApi();
      tickets.syncState = 'failed';

      expect(await new TicketsAdapter(tickets).find('moritz/aisf', 138)).toMatchObject({
        syncFailed: true,
      });
    });

    it('should not flag syncFailed when the sync state is ok', async () => {
      const adapter = new TicketsAdapter(new FakeTicketsApi());

      expect(await adapter.find('moritz/aisf', 138)).toMatchObject({ syncFailed: false });
    });

    it('should return undefined when the ticket is unknown', async () => {
      const adapter = new TicketsAdapter(new FakeTicketsApi());

      expect(await adapter.find('moritz/aisf', 999)).toBeUndefined();
    });
  });

  describe('begin', () => {
    it('should throw RunNotAnswerableError with the message when tickets refuses the answer with a conflict', async () => {
      const tickets = new FakeTicketsApi();
      tickets.beginFailure = new ConflictError('#7 is not waiting');

      await expect(new TicketsAdapter(tickets).begin('moritz/aisf', 7)).rejects.toThrow(
        new RunNotAnswerableError('#7 is not waiting'),
      );
    });

    it('should rethrow the failure when tickets fails with anything else', async () => {
      const tickets = new FakeTicketsApi();
      const failure = new Error('boom');
      tickets.beginFailure = failure;

      await expect(new TicketsAdapter(tickets).begin('moritz/aisf', 7)).rejects.toBe(failure);
    });
  });
});
