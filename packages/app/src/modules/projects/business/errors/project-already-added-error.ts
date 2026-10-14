import { ConflictError } from '../../../../shared/errors.js';

export class ProjectAlreadyAddedError extends ConflictError {
  override readonly name = 'ProjectAlreadyAddedError';
}
