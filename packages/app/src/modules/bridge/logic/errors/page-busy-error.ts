export class PageBusyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PageBusyError';
  }
}
