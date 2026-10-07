import { ArtifactNotFoundError } from '../errors/artifact-not-found-error.js';
import type { ArtifactFiles } from '../ports/artifact-files.js';
import type { ArtifactRepository } from '../ports/artifact-repository.js';

export type ReadPageAssetDependencies = {
  readonly artifactRepository: ArtifactRepository;
  readonly artifactFiles: ArtifactFiles;
};

export class ReadPageAssetUseCase {
  constructor(private readonly dependencies: ReadPageAssetDependencies) {}

  async execute(token: string, relativePath: string): Promise<Uint8Array> {
    const { artifactRepository, artifactFiles } = this.dependencies;
    const artifact = await artifactRepository.findByToken(token);
    const content =
      artifact === undefined
        ? undefined
        : await artifactFiles.readAsset(artifact.directory, relativePath);
    if (content === undefined) {
      throw new ArtifactNotFoundError('Unknown file');
    }
    return content;
  }
}
