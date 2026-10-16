import { ConflictError } from '../../../../shared/errors.js';

export class RunNotAvailableError extends ConflictError {
  override readonly name = 'RunNotAvailableError';
}
