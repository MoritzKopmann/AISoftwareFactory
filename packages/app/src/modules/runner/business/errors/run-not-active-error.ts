import { ConflictError } from '../../../../shared/errors.js';

export class RunNotActiveError extends ConflictError {
  override readonly name = 'RunNotActiveError';
}
