import { UpstreamError } from '../../../../shared/errors.js';

export class GitHubRateLimitedError extends UpstreamError {
  override readonly name = 'GitHubRateLimitedError';

  constructor(
    message: string,
    readonly retryAt: Date,
  ) {
    super(message);
  }
}
