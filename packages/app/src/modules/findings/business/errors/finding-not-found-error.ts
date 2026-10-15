import { NotFoundError } from '../../../../shared/errors.js';

export class FindingNotFoundError extends NotFoundError {
  override readonly name = 'FindingNotFoundError';
}
