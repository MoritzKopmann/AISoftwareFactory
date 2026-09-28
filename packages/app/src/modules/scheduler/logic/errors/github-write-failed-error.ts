export class GitHubWriteFailedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GitHubWriteFailedError';
  }
}
