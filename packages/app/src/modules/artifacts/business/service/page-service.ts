import { decidePageStatus } from '../domain/functions/decide-page-status.js';
import { formatPageEvent } from '../domain/functions/format-page-event.js';
import { injectPageBridge } from '../domain/functions/inject-page-bridge.js';
import type { Artifact } from '../domain/types/artifact.js';
import type { PageEvent } from '../domain/types/page-event.js';
import type { PageState } from '../domain/types/page-state.js';
import { ArtifactNotFoundError } from '../errors/artifact-not-found-error.js';
import { PageBusyError } from '../errors/page-busy-error.js';
import { PageClosedError } from '../errors/page-closed-error.js';
import type { CheckpointAnswers } from '../port/checkpoint/checkpoint-answers.js';
import type { ArtifactFiles } from '../port/file/artifact-files.js';
import type { ArtifactRepository } from '../port/repository/artifact-repository.js';
import type { TicketRunLookup } from '../port/run/ticket-run-lookup.js';

export type PageServiceDependencies = {
  readonly artifactRepository: ArtifactRepository;
  readonly artifactFiles: ArtifactFiles;
  readonly ticketRunLookup: TicketRunLookup;
  readonly checkpointAnswers: CheckpointAnswers;
};

export class PageService {
  constructor(private readonly dependencies: PageServiceDependencies) {}

  async read(token: string, nonce: string): Promise<string> {
    const { artifactRepository, artifactFiles } = this.dependencies;
    const artifact = await artifactRepository.findByToken(token);
    const html =
      artifact === undefined ? undefined : await artifactFiles.readIndex(artifact.directory);
    if (html === undefined) {
      throw new ArtifactNotFoundError('Unknown page');
    }
    return injectPageBridge(html, nonce);
  }

  async readAsset(token: string, relativePath: string): Promise<Uint8Array> {
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

  async readStatus(token: string): Promise<PageState> {
    const { ticketRunLookup } = this.dependencies;
    const artifact = await this.requireArtifact(token);
    const latestRun = await ticketRunLookup.latest(artifact.projectId, artifact.ticketNumber);
    return { status: decidePageStatus(artifact, latestRun), version: artifact.version };
  }

  /** The stored draft as JSON text, or `null` when nothing was saved. */
  async readUserInputState(token: string): Promise<string> {
    const { artifactFiles } = this.dependencies;
    const artifact = await this.requireArtifact(token);
    return (await artifactFiles.readUserInputState(artifact.directory)) ?? 'null';
  }

  async writeUserInputState(token: string, userInputState: string): Promise<void> {
    const { artifactFiles } = this.dependencies;
    const artifact = await this.requireArtifact(token);
    await artifactFiles.writeUserInputState(artifact.directory, userInputState);
  }

  async submitEvent(token: string, event: PageEvent): Promise<void> {
    const { ticketRunLookup, checkpointAnswers } = this.dependencies;
    const artifact = await this.requireArtifact(token);
    const latestRun = await ticketRunLookup.latest(artifact.projectId, artifact.ticketNumber);
    const status = decidePageStatus(artifact, latestRun);
    if (status === 'busy') {
      throw new PageBusyError('The session is busy');
    }
    if (status === 'closed') {
      throw new PageClosedError('The page is closed');
    }
    await checkpointAnswers.answer(artifact.runId, formatPageEvent(artifact.artifactId, event));
  }

  private async requireArtifact(token: string): Promise<Artifact> {
    const artifact = await this.dependencies.artifactRepository.findByToken(token);
    if (artifact === undefined) {
      throw new ArtifactNotFoundError('Unknown page');
    }
    return artifact;
  }
}
