import { ConflictError } from '../../../../shared/errors.js';

export class TicketNotAnswerableError extends ConflictError {
  override readonly name = 'TicketNotAnswerableError';
}
