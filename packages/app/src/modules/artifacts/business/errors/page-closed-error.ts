import { ConflictError } from '../../../../shared/errors.js';

export class PageClosedError extends ConflictError {
  override readonly name = 'PageClosedError';
}
