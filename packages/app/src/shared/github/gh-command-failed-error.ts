export class GhCommandFailedError extends Error {
  constructor(message: string, options?: { readonly cause?: unknown }) {
    super(message, options);
    this.name = 'GhCommandFailedError';
  }
}
