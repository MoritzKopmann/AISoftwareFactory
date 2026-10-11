export class IdeaRunNotStartedError extends Error {
  constructor(
    readonly ticketNumber: number,
    message: string,
  ) {
    super(message);
    this.name = 'IdeaRunNotStartedError';
  }
}
