import { ConflictError } from '../../../../shared/errors.js';

export class RunNotResumableError extends ConflictError {
  override readonly name = 'RunNotResumableError';
}
