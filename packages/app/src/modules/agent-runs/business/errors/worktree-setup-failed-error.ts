import { UpstreamError } from '../../../../shared/errors.js';

export class WorktreeSetupFailedError extends UpstreamError {
  override readonly name = 'WorktreeSetupFailedError';
}
