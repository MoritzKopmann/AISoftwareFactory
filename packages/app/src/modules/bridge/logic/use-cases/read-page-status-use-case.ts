import { decidePageStatus } from '../domain/functions/decide-page-status.js';
import type { PageStatus } from '../domain/types/page-status.js';
import { ArtifactNotFoundError } from '../errors/artifact-not-found-error.js';
import type { ArtifactRepository } from '../ports/artifact-repository.js';
import type { TicketRunLookup } from '../ports/ticket-run-lookup.js';

export type ReadPageStatusDependencies = {
  readonly artifactRepository: ArtifactRepository;
  readonly ticketRunLookup: TicketRunLookup;
};

export class ReadPageStatusUseCase {
  constructor(private readonly dependencies: ReadPageStatusDependencies) {}

  async execute(token: string): Promise<{ status: PageStatus; version: number }> {
    const { artifactRepository, ticketRunLookup } = this.dependencies;
    const artifact = await artifactRepository.findByToken(token);
    if (artifact === undefined) {
      throw new ArtifactNotFoundError('Unknown page');
    }
    const latestRun = await ticketRunLookup.latest(artifact.projectId, artifact.ticketNumber);
    return { status: decidePageStatus(artifact, latestRun), version: artifact.version };
  }
}
