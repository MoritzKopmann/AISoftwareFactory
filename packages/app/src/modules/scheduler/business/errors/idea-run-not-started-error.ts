import { ConflictError } from '../../../../shared/errors.js';

export class IdeaRunNotStartedError extends ConflictError {
  override readonly name = 'IdeaRunNotStartedError';

  constructor(
    readonly ticketNumber: number,
    message: string,
  ) {
    super(message);
  }
}
