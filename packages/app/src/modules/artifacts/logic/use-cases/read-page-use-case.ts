import { injectPageBridge } from '../domain/functions/inject-page-bridge.js';
import { ArtifactNotFoundError } from '../errors/artifact-not-found-error.js';
import type { ArtifactFiles } from '../ports/artifact-files.js';
import type { ArtifactRepository } from '../ports/artifact-repository.js';

export type ReadPageDependencies = {
  readonly artifactRepository: ArtifactRepository;
  readonly artifactFiles: ArtifactFiles;
};

export class ReadPageUseCase {
  constructor(private readonly dependencies: ReadPageDependencies) {}

  async execute(token: string, nonce: string): Promise<string> {
    const { artifactRepository, artifactFiles } = this.dependencies;
    const artifact = await artifactRepository.findByToken(token);
    const html =
      artifact === undefined ? undefined : await artifactFiles.readIndex(artifact.directory);
    if (html === undefined) {
      throw new ArtifactNotFoundError('Unknown page');
    }
    return injectPageBridge(html, nonce);
  }
}
