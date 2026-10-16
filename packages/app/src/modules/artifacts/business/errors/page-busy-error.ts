import { ConflictError } from '../../../../shared/errors.js';

export class PageBusyError extends ConflictError {
  override readonly name = 'PageBusyError';
}
