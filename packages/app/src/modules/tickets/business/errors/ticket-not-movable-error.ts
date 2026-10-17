import { ConflictError } from '../../../../shared/errors.js';

export class TicketNotMovableError extends ConflictError {
  override readonly name = 'TicketNotMovableError';
}
