import type { Project } from '../domain/project.js';

export interface ProjectRepository {
  findById(id: string): Promise<Project | undefined>;
  list(): Promise<ReadonlyArray<Project>>;
  save(project: Project): Promise<void>;
}
