import { UnprocessableError } from '../../../../shared/errors.js';

export class CheckoutNotARepositoryError extends UnprocessableError {
  override readonly name = 'CheckoutNotARepositoryError';
}
