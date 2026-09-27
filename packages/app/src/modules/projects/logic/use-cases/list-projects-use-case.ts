import type { Project } from '../domain/project.js';
import type { ProjectRepository } from '../ports/project-repository.js';

export class ListProjectsUseCase {
  constructor(private readonly projectRepository: ProjectRepository) {}

  async execute(): Promise<ReadonlyArray<Project>> {
    return this.projectRepository.list();
  }
}
