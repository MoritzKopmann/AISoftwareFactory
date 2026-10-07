import { ArtifactNotFoundError } from '../errors/artifact-not-found-error.js';
import type { ArtifactFiles } from '../ports/artifact-files.js';
import type { ArtifactRepository } from '../ports/artifact-repository.js';

export type ReadPageUserInputStateDependencies = {
  readonly artifactRepository: ArtifactRepository;
  readonly artifactFiles: ArtifactFiles;
};

export class ReadPageUserInputStateUseCase {
  constructor(private readonly dependencies: ReadPageUserInputStateDependencies) {}

  /** The stored draft as JSON text, or `null` when nothing was saved. */
  async execute(token: string): Promise<string> {
    const { artifactRepository, artifactFiles } = this.dependencies;
    const artifact = await artifactRepository.findByToken(token);
    if (artifact === undefined) {
      throw new ArtifactNotFoundError('Unknown page');
    }
    return (await artifactFiles.readUserInputState(artifact.directory)) ?? 'null';
  }
}
