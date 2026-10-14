import { UpstreamError } from '../../../../shared/errors.js';

export class IdeaCreationFailedError extends UpstreamError {
  override readonly name = 'IdeaCreationFailedError';
}
