import { ConflictError } from '../../../../shared/errors.js';

export class RunNotAnswerableError extends ConflictError {
  override readonly name = 'RunNotAnswerableError';
}
