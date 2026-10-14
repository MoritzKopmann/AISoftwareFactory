import { ConflictError } from '../../../../shared/errors.js';

export class TicketNotResettableError extends ConflictError {
  override readonly name = 'TicketNotResettableError';
}
