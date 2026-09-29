export class PullRequestMergeFailedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PullRequestMergeFailedError';
  }
}
