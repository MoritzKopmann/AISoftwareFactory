export class PermissionNotAnswerableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PermissionNotAnswerableError';
  }
}
