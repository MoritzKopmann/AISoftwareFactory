import type { TicketsApi } from '../../../tickets/index.js';
import { ConflictError } from '../../../../shared/errors.js';
import { RunNotAnswerableError } from '../../business/errors/run-not-answerable-error.js';
import type { TicketAnswerGate } from '../../business/port/ticket/ticket-answer-gate.js';

export class TicketsTicketAnswerGate implements TicketAnswerGate {
  constructor(private readonly tickets: Pick<TicketsApi, 'beginAnswer' | 'revertAnswer'>) {}

  async begin(projectId: string, ticketNumber: number): Promise<void> {
    try {
      await this.tickets.beginAnswer(projectId, ticketNumber);
    } catch (error) {
      if (error instanceof ConflictError) {
        throw new RunNotAnswerableError(error.message);
      }
      throw error;
    }
  }

  revert(projectId: string, ticketNumber: number): Promise<void> {
    return this.tickets.revertAnswer(projectId, ticketNumber);
  }
}
