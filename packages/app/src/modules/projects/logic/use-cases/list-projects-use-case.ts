import type { ContractPreflightReport } from '../domain/types/contract-preflight-report.js';
import type { Project } from '../domain/types/project.js';
import type { ContractPreflight } from '../ports/contract-preflight.js';
import type { ProjectRepository } from '../ports/project-repository.js';

export type ProjectWithContract = Project & { readonly contract: ContractPreflightReport };

export class ListProjectsUseCase {
  constructor(
    private readonly projectRepository: ProjectRepository,
    private readonly contractPreflight: ContractPreflight,
  ) {}

  async execute(): Promise<ReadonlyArray<ProjectWithContract>> {
    const projects = await this.projectRepository.list();
    return Promise.all(
      projects.map(async (project) => ({
        ...project,
        contract: await this.contractPreflight.check(project.checkoutPath),
      })),
    );
  }
}
