import { UpstreamError } from '../../../../shared/errors.js';

export class PullRequestMergeFailedError extends UpstreamError {
  override readonly name = 'PullRequestMergeFailedError';
}
