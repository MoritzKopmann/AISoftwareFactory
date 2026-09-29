export class TicketWriteFailedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TicketWriteFailedError';
  }
}
