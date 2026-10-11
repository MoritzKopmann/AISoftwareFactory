export class IdeaCreationFailedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IdeaCreationFailedError';
  }
}
