import { attachContract } from '../domain/functions/attach-contract.js';
import type { ProjectWithContract } from '../domain/types/project-with-contract.js';
import type { ContractPreflight } from '../ports/contract-preflight.js';
import type { ProjectRepository } from '../ports/project-repository.js';

export class ListProjectsUseCase {
  constructor(
    private readonly projectRepository: ProjectRepository,
    private readonly contractPreflight: ContractPreflight,
  ) {}

  async execute(): Promise<ReadonlyArray<ProjectWithContract>> {
    const projects = await this.projectRepository.list();
    return Promise.all(
      projects.map(async (project) =>
        attachContract(project, await this.contractPreflight.check(project.checkoutPath)),
      ),
    );
  }
}
