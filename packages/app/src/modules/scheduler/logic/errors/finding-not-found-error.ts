export class FindingNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FindingNotFoundError';
  }
}
