import type { Finding } from '../domain/types/finding.js';
import type { FindingRepository } from '../ports/finding-repository.js';

export type ListFindingsDependencies = {
  readonly findingRepository: FindingRepository;
};

export class ListFindingsUseCase {
  constructor(private readonly dependencies: ListFindingsDependencies) {}

  async execute(projectId: string, ticketNumber?: number): Promise<ReadonlyArray<Finding>> {
    return this.dependencies.findingRepository.list(projectId, ticketNumber);
  }
}
