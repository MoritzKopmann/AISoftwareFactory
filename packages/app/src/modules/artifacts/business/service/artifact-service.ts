import type { Clock } from '../../../../shared/clock/clock.js';
import type { EventPublisher } from '../../../../shared/event-bus.js';
import type { Identifiers } from '../../../../shared/identifiers/identifiers.js';
import { artifactDirectoryFor } from '../domain/functions/artifact-directory-for.js';
import { decidePageStatus } from '../domain/functions/decide-page-status.js';
import type { Artifact } from '../domain/types/artifact.js';
import type { ListedArtifact } from '../domain/types/listed-artifact.js';
import type { PublishRequest } from '../domain/types/publish-request.js';
import { ArtifactNotFoundError } from '../errors/artifact-not-found-error.js';
import type { ArtifactFiles } from '../port/file/artifact-files.js';
import type { ArtifactRepository } from '../port/repository/artifact-repository.js';
import type { TicketRunLookup } from '../port/run/ticket-run-lookup.js';

export type ArtifactServiceDependencies = {
  readonly artifactRepository: ArtifactRepository;
  readonly artifactFiles: ArtifactFiles;
  readonly ticketRunLookup: TicketRunLookup;
  readonly events: EventPublisher;
  readonly identifiers: Identifiers;
  readonly clock: Clock;
};

export class ArtifactService {
  constructor(private readonly dependencies: ArtifactServiceDependencies) {}

  async publish(request: PublishRequest): Promise<Artifact> {
    const { artifactRepository, artifactFiles, events, identifiers, clock } = this.dependencies;
    const directory = artifactDirectoryFor(request.worktreePath, request.artifactId);
    if (!(await artifactFiles.hasIndex(directory))) {
      throw new ArtifactNotFoundError(
        `The artifact "${request.artifactId}" has no index.html in .aisf/artifacts/${request.artifactId}/`,
      );
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

  async listForTicket(
    projectId: string,
    ticketNumber: number,
  ): Promise<ReadonlyArray<ListedArtifact>> {
    const { artifactRepository, ticketRunLookup } = this.dependencies;
    const artifacts = await artifactRepository.listForTicket(projectId, ticketNumber);
    const latestRun = await ticketRunLookup.latest(projectId, ticketNumber);
    return artifacts.map((artifact) => ({
      artifactId: artifact.artifactId,
      title: artifact.title,
      token: artifact.token,
      status: decidePageStatus(artifact, latestRun),
    }));
  }
}
