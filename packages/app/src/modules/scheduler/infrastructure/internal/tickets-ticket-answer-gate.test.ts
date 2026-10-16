import { describe, expect, it } from 'vitest';
import { ConflictError } from '../../../../shared/errors.js';
import { RunNotAnswerableError } from '../../business/errors/run-not-answerable-error.js';
import { FakeTicketsApi } from '../../testing/fake-scheduler-apis.js';
import { TicketsTicketAnswerGate } from './tickets-ticket-answer-gate.js';

describe('TicketsTicketAnswerGate', () => {
  it('should throw RunNotAnswerableError with the message when tickets refuses the answer with a conflict', async () => {
    const tickets = new FakeTicketsApi();
    tickets.beginFailure = new ConflictError('#7 is not waiting');

    await expect(new TicketsTicketAnswerGate(tickets).begin('moritz/aisf', 7)).rejects.toThrow(
      new RunNotAnswerableError('#7 is not waiting'),
    );
  });

  it('should rethrow the failure when tickets fails with anything else', async () => {
    const tickets = new FakeTicketsApi();
    const failure = new Error('boom');
    tickets.beginFailure = failure;

    await expect(new TicketsTicketAnswerGate(tickets).begin('moritz/aisf', 7)).rejects.toBe(
      failure,
    );
  });
});
