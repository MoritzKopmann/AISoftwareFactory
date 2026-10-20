import { ConflictError } from '../../../../shared/errors.js';

export class OnboardingNotNeededError extends ConflictError {
  override readonly name = 'OnboardingNotNeededError';
}
