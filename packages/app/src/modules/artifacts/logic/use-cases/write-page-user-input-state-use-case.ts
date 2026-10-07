import { ArtifactNotFoundError } from '../errors/artifact-not-found-error.js';
import type { ArtifactFiles } from '../ports/artifact-files.js';
import type { ArtifactRepository } from '../ports/artifact-repository.js';

export type WritePageUserInputStateDependencies = {
  readonly artifactRepository: ArtifactRepository;
  readonly artifactFiles: ArtifactFiles;
};

export class WritePageUserInputStateUseCase {
  constructor(private readonly dependencies: WritePageUserInputStateDependencies) {}

  async execute(token: string, userInputState: string): Promise<void> {
    const { artifactRepository, artifactFiles } = this.dependencies;
    const artifact = await artifactRepository.findByToken(token);
    if (artifact === undefined) {
      throw new ArtifactNotFoundError('Unknown page');
    }
    await artifactFiles.writeUserInputState(artifact.directory, userInputState);
  }
}
