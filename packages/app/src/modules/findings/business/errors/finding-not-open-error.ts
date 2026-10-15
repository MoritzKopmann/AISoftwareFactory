import { ConflictError } from '../../../../shared/errors.js';

export class FindingNotOpenError extends ConflictError {
  override readonly name = 'FindingNotOpenError';
}
