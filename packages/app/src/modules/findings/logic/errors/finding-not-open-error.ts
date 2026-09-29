export class FindingNotOpenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FindingNotOpenError';
  }
}
