import { ConflictError } from '../../../../shared/errors.js';

export class RunAlreadyActiveError extends ConflictError {
  override readonly name = 'RunAlreadyActiveError';
}
