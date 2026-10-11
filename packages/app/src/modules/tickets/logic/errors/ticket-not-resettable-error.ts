export class TicketNotResettableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TicketNotResettableError';
  }
}
