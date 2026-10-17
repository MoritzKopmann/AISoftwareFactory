import { NotFoundError } from '../../../../shared/errors.js';

export class ProjectNotFoundError extends NotFoundError {
  override readonly name = 'ProjectNotFoundError';
}
