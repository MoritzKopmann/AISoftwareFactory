export class TicketNotAnswerableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TicketNotAnswerableError';
  }
}
