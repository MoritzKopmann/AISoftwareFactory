export class GitHubRateLimitedError extends Error {
  override readonly name = 'GitHubRateLimitedError';

  constructor(
    message: string,
    readonly retryAt: Date,
  ) {
    super(message);
  }
}
