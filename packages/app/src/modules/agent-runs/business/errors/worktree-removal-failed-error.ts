import { UpstreamError } from '../../../../shared/errors.js';

export class WorktreeRemovalFailedError extends UpstreamError {
  override readonly name = 'WorktreeRemovalFailedError';
}
