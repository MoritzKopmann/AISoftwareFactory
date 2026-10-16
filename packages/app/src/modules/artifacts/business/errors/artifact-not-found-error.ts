import { NotFoundError } from '../../../../shared/errors.js';

export class ArtifactNotFoundError extends NotFoundError {
  override readonly name = 'ArtifactNotFoundError';
}
