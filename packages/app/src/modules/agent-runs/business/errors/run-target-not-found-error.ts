import { NotFoundError } from '../../../../shared/errors.js';

export class RunTargetNotFoundError extends NotFoundError {
  override readonly name = 'RunTargetNotFoundError';
}
