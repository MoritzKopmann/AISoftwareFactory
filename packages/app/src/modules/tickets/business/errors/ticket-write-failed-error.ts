import { UpstreamError } from '../../../../shared/errors.js';

export class TicketWriteFailedError extends UpstreamError {
  override readonly name = 'TicketWriteFailedError';
}
