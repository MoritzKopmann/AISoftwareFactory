import type { EventPublisher } from '../../../../shared/bus/event-publisher.js';
import type { Clock } from '../../../../shared/clock/clock.js';
import type { Identifiers } from '../../../../shared/identifiers/identifiers.js';
import { artifactDirectoryFor } from '../domain/functions/artifact-directory-for.js';
import type { Artifact } from '../domain/types/artifact.js';
import { ArtifactNotFoundError } from '../errors/artifact-not-found-error.js';
import type { ArtifactFiles } from '../ports/artifact-files.js';
import type { ArtifactRepository } from '../ports/artifact-repository.js';

export type PublishArtifactRequest = {
  readonly projectId: string;
  readonly ticketNumber: number;
  readonly runId: string;
  readonly worktreePath: string;
  readonly artifactId: string;
  readonly title: string;
};

export type PublishArtifactDependencies = {
  readonly artifactRepository: ArtifactRepository;
  readonly artifactFiles: ArtifactFiles;
  readonly events: EventPublisher;
  readonly identifiers: Identifiers;
  readonly clock: Clock;
};

export class PublishArtifactUseCase {
  constructor(private readonly dependencies: PublishArtifactDependencies) {}

  async execute(request: PublishArtifactRequest): Promise<Artifact> {
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
}
