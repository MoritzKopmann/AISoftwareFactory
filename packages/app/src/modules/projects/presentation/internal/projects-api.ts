import type { ProjectDto } from '../dto/internal/project-dto.js';

/** What other modules may ask of projects. */
export interface ProjectsApi {
  list(): Promise<ReadonlyArray<ProjectDto>>;
}
