export class RunNotAnswerableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RunNotAnswerableError';
  }
}
