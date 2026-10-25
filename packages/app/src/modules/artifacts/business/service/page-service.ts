import { artifactKindFor, type ArtifactKind } from '../domain/functions/artifact-kind-for.js';
import { decidePageStatus } from '../domain/functions/decide-page-status.js';
import { formatPageEvent } from '../domain/functions/format-page-event.js';
import { injectPageBridge } from '../domain/functions/inject-page-bridge.js';
import type { Artifact } from '../domain/types/artifact.js';
import type { PageEvent } from '../domain/types/page-event.js';
import type { PageState } from '../domain/types/page-state.js';
import { ArtifactNotFoundError } from '../errors/artifact-not-found-error.js';
import { PageBusyError } from '../errors/page-busy-error.js';
import { PageClosedError } from '../errors/page-closed-error.js';
import type { SchedulerPort } from '../port/scheduler/scheduler-port.js';
import type { ArtifactFiles } from '../port/file/artifact-files.js';
import type { DesignWatcher } from '../port/watch/design-watcher.js';
import type { ArtifactRepository } from '../port/repository/artifact-repository.js';
import type { RunPort } from '../port/run/run-port.js';

export type PageServiceDependencies = {
  readonly artifactRepository: ArtifactRepository;
  readonly artifactFiles: ArtifactFiles;
  readonly runPort: RunPort;
  readonly schedulerPort: SchedulerPort;
  readonly designWatcher: DesignWatcher;
};

export class PageService {
  constructor(private readonly dependencies: PageServiceDependencies) {}

  async read(token: string, nonce: string): Promise<string> {
    const artifact = await this.dependencies.artifactRepository.findByToken(token);
    const html = artifact === undefined ? undefined : await this.readDocument(artifact);
    if (html === undefined) {
      throw new ArtifactNotFoundError('Unknown page');
    }
    return injectPageBridge(html, nonce);
  }

  /** `undefined` when the token is unknown. */
  async kindOf(token: string): Promise<ArtifactKind | undefined> {
    const artifact = await this.dependencies.artifactRepository.findByToken(token);
    return artifact === undefined ? undefined : artifactKindFor(artifact.artifactId);
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
    const { runPort } = this.dependencies;
    const artifact = await this.requireArtifact(token);
    const latestRun = await runPort.latest(artifact.projectId, artifact.ticketNumber);
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
    const { runPort, schedulerPort } = this.dependencies;
    const artifact = await this.requireArtifact(token);
    const latestRun = await runPort.latest(artifact.projectId, artifact.ticketNumber);
    const status = decidePageStatus(artifact, latestRun);
    if (status === 'busy') {
      throw new PageBusyError('The session is busy');
    }
    if (status === 'closed') {
      throw new PageClosedError('The page is closed');
    }
    await schedulerPort.answer(artifact.runId, formatPageEvent(artifact.artifactId, event));
  }

  /** Boards only. Returns a stop function. */
  async watchChanges(token: string, onChange: (file: string) => void): Promise<() => void> {
    const artifact = await this.requireArtifact(token);
    if (artifactKindFor(artifact.artifactId) !== 'board') {
      throw new ArtifactNotFoundError('Unknown board');
    }
    return this.dependencies.designWatcher.watch(artifact.directory, onChange);
  }

  private async readDocument(artifact: Artifact): Promise<string | undefined> {
    const { artifactFiles } = this.dependencies;
    if (artifactKindFor(artifact.artifactId) === 'board') {
      return artifactFiles.readBoardShell();
    }
    return artifactFiles.readIndex(artifact.directory);
  }

  private async requireArtifact(token: string): Promise<Artifact> {
    const artifact = await this.dependencies.artifactRepository.findByToken(token);
    if (artifact === undefined) {
      throw new ArtifactNotFoundError('Unknown page');
    }
    return artifact;
  }
}
