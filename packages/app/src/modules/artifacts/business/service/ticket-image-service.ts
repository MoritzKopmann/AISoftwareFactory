import type { ArtifactFiles } from '../port/file/artifact-files.js';
import type { RunPort } from '../port/run/run-port.js';

const IMAGE_FOLDER = '.aisf/images';

export type TicketImageServiceDependencies = {
  readonly runPort: RunPort;
  readonly artifactFiles: ArtifactFiles;
};

export class TicketImageService {
  constructor(private readonly dependencies: TicketImageServiceDependencies) {}

  async list(projectId: string, ticketNumber: number): Promise<ReadonlyArray<string>> {
    const directory = await this.imageDirectory(projectId, ticketNumber);
    return directory === undefined ? [] : this.dependencies.artifactFiles.listImages(directory);
  }

  async read(
    projectId: string,
    ticketNumber: number,
    name: string,
  ): Promise<{ bytes: Uint8Array } | undefined> {
    const directory = await this.imageDirectory(projectId, ticketNumber);
    if (directory === undefined) {
      return undefined;
    }
    const bytes = await this.dependencies.artifactFiles.readAsset(directory, name);
    return bytes === undefined ? undefined : { bytes };
  }

  private async imageDirectory(
    projectId: string,
    ticketNumber: number,
  ): Promise<string | undefined> {
    const run = await this.dependencies.runPort.latest(projectId, ticketNumber);
    return run === undefined ? undefined : `${run.worktreePath}/${IMAGE_FOLDER}`;
  }
}
