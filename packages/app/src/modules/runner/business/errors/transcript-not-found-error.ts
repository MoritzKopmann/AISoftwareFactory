import { NotFoundError } from '../../../../shared/errors.js';

export class TranscriptNotFoundError extends NotFoundError {
  override readonly name = 'TranscriptNotFoundError';
}
