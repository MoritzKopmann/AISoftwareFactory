export class RunNotAvailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RunNotAvailableError';
  }
}
