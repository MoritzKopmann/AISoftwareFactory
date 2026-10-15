import { UpstreamError } from '../../../../shared/errors.js';

export class TicketCreationFailedError extends UpstreamError {
  override readonly name = 'TicketCreationFailedError';
}
