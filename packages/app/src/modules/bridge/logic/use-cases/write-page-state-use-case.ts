import { ArtifactNotFoundError } from '../errors/artifact-not-found-error.js';
import type { ArtifactFiles } from '../ports/artifact-files.js';
import type { ArtifactRepository } from '../ports/artifact-repository.js';

export type WritePageStateDependencies = {
  readonly artifactRepository: ArtifactRepository;
  readonly artifactFiles: ArtifactFiles;
};

export class WritePageStateUseCase {
  constructor(private readonly dependencies: WritePageStateDependencies) {}

  async execute(token: string, state: string): Promise<void> {
    const { artifactRepository, artifactFiles } = this.dependencies;
    const artifact = await artifactRepository.findByToken(token);
    if (artifact === undefined) {
      throw new ArtifactNotFoundError('Unknown page');
    }
    await artifactFiles.writeState(artifact.directory, state);
  }
}
