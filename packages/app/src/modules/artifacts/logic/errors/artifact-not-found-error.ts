export class ArtifactNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ArtifactNotFoundError';
  }
}
