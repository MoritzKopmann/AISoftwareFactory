import type { ProjectService } from '../../business/service/project-service.js';
import type { ProjectDto } from '../dto/internal/project-dto.js';
import { toProjectDto } from '../dto/mapper/project-mapper.js';
import type { ProjectsApi } from './projects-api.js';

export class ProjectsFacade implements ProjectsApi {
  constructor(private readonly projectService: ProjectService) {}

  async list(): Promise<ReadonlyArray<ProjectDto>> {
    return (await this.projectService.list()).map(toProjectDto);
  }
}
