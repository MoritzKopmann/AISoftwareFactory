import type { Clock } from '../../../../shared/clock/clock.js';
import type { EventPublisher } from '../../../../shared/event-bus.js';
import type { Identifiers } from '../../../../shared/identifiers/identifiers.js';
import { artifactDirectoryFor } from '../domain/functions/artifact-directory-for.js';
import { artifactKindFor } from '../domain/functions/artifact-kind-for.js';
import { decidePageStatus } from '../domain/functions/decide-page-status.js';
import { decideRoundAfterFeedback } from '../domain/functions/decide-round-after-feedback.js';
import { readSentBoardRound } from '../domain/functions/read-sent-board-round.js';
import type { Artifact } from '../domain/types/artifact.js';
import type { ListedArtifact } from '../domain/types/listed-artifact.js';
import type { PublishRequest } from '../domain/types/publish-request.js';
import { ArtifactNotFoundError } from '../errors/artifact-not-found-error.js';
import type { ArtifactFiles } from '../port/file/artifact-files.js';
import type { ArtifactRepository } from '../port/repository/artifact-repository.js';
import type { RunPort } from '../port/run/run-port.js';

export type ArtifactServiceDependencies = {
  readonly artifactRepository: ArtifactRepository;
  readonly artifactFiles: ArtifactFiles;
  readonly runPort: RunPort;
  readonly events: EventPublisher;
  readonly identifiers: Identifiers;
  readonly clock: Clock;
};

export class ArtifactService {
  constructor(private readonly dependencies: ArtifactServiceDependencies) {}

  async publish(request: PublishRequest): Promise<Artifact> {
    const { artifactRepository, artifactFiles, events, identifiers, clock } = this.dependencies;
    const directory = artifactDirectoryFor(request.worktreePath, request.artifactId);
    const isBoard = artifactKindFor(request.artifactId) === 'board';
    const indexName = isBoard ? 'index.json' : 'index.html';
    const hasIndex = isBoard
      ? await artifactFiles.hasDesignIndex(directory)
      : await artifactFiles.hasIndex(directory);
    if (!hasIndex) {
      throw new ArtifactNotFoundError(
        `The artifact "${request.artifactId}" has no ${indexName} in .aisf/artifacts/${request.artifactId}/`,
      );
    }
    if (isBoard) {
      await this.raiseRoundAfterFeedback(directory);
    }
    const artifact = await artifactRepository.publish({
      token: identifiers.next(),
      projectId: request.projectId,
      ticketNumber: request.ticketNumber,
      artifactId: request.artifactId,
      title: request.title,
      directory,
      runId: request.runId,
      publishedAt: clock.now(),
    });
    events.emit('artifact.published', {
      projectId: request.projectId,
      ticketNumber: request.ticketNumber,
      artifactId: request.artifactId,
    });
    return artifact;
  }

  /** Gives the human the turn: a board whose feedback went out for the current round moves to the next one. */
  private async raiseRoundAfterFeedback(directory: string): Promise<void> {
    const { artifactFiles } = this.dependencies;
    const round = await artifactFiles.readDesignRound(directory);
    const sentRound = readSentBoardRound(await artifactFiles.readUserInputState(directory));
    const nextRound = decideRoundAfterFeedback(round, sentRound);
    if (nextRound !== undefined) {
      await artifactFiles.writeDesignRound(directory, nextRound);
    }
  }

  async listForTicket(
    projectId: string,
    ticketNumber: number,
  ): Promise<ReadonlyArray<ListedArtifact>> {
    const { artifactRepository, runPort } = this.dependencies;
    const artifacts = await artifactRepository.listForTicket(projectId, ticketNumber);
    const latestRun = await runPort.latest(projectId, ticketNumber);
    return artifacts.map((artifact) => ({
      artifactId: artifact.artifactId,
      title: artifact.title,
      token: artifact.token,
      status: decidePageStatus(artifact, latestRun),
    }));
  }
}
