import { attachContract } from '../domain/functions/attach-contract.js';
import type { ProjectWithContract } from '../domain/types/project-with-contract.js';
import type { ContractPreflight } from '../ports/contract-preflight.js';
import type { ProjectRepository } from '../ports/project-repository.js';

export class FindProjectUseCase {
  constructor(
    private readonly projectRepository: ProjectRepository,
    private readonly contractPreflight: ContractPreflight,
  ) {}

  async execute(projectId: string): Promise<ProjectWithContract | undefined> {
    const project = await this.projectRepository.findById(projectId);
    if (project === undefined) {
      return undefined;
    }
    return attachContract(project, await this.contractPreflight.check(project.checkoutPath));
  }
}
