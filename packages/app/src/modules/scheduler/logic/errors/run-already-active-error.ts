export class RunAlreadyActiveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RunAlreadyActiveError';
  }
}
