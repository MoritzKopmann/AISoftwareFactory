import type { TicketPage } from '../domain/types/ticket-page.js';
import type { ArtifactRepository } from '../ports/artifact-repository.js';

export type FindTicketPageDependencies = {
  readonly artifactRepository: ArtifactRepository;
};

export class FindTicketPageUseCase {
  constructor(private readonly dependencies: FindTicketPageDependencies) {}

  async execute(
    projectId: string,
    ticketNumber: number,
    artifactId: string,
  ): Promise<TicketPage | undefined> {
    const artifacts = await this.dependencies.artifactRepository.listForTicket(
      projectId,
      ticketNumber,
    );
    const artifact = artifacts.find((candidate) => candidate.artifactId === artifactId);
    return artifact === undefined
      ? undefined
      : { title: artifact.title, url: `/a/${artifact.token}/` };
  }
}
