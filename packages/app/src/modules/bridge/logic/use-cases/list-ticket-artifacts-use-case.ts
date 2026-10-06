import { decidePageStatus } from '../domain/functions/decide-page-status.js';
import type { PageStatus } from '../domain/types/page-status.js';
import type { ArtifactRepository } from '../ports/artifact-repository.js';
import type { TicketRunLookup } from '../ports/ticket-run-lookup.js';

export type ListedArtifact = {
  readonly artifactId: string;
  readonly title: string;
  readonly token: string;
  readonly status: PageStatus;
};

export type ListTicketArtifactsDependencies = {
  readonly artifactRepository: ArtifactRepository;
  readonly ticketRunLookup: TicketRunLookup;
};

export class ListTicketArtifactsUseCase {
  constructor(private readonly dependencies: ListTicketArtifactsDependencies) {}

  async execute(projectId: string, ticketNumber: number): Promise<ReadonlyArray<ListedArtifact>> {
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
