import type { Project } from '../../../business/domain/types/project.js';
import type { ProjectWithContract } from '../../../business/domain/types/project-with-contract.js';
import type { ProjectAddedResponse, ProjectResponse } from '../api/projects-schemas.js';
import type { ProjectDto } from '../internal/project-dto.js';

function toRepository(project: Project): Project['repository'] {
  return { owner: project.repository.owner, name: project.repository.name };
}

export function toProjectAddedResponse(project: Project): ProjectAddedResponse {
  return {
    id: project.id,
    repository: toRepository(project),
    checkoutPath: project.checkoutPath,
    addedAt: project.addedAt,
  };
}

export function toProjectResponse(project: ProjectWithContract): ProjectResponse {
  return {
    ...toProjectAddedResponse(project),
    contract: {
      passed: project.contract.passed,
      missingSlots: [...project.contract.missingSlots],
      missingKeys: [...project.contract.missingKeys],
    },
  };
}

export function toProjectDto(project: ProjectWithContract): ProjectDto {
  return {
    id: project.id,
    repository: toRepository(project),
    checkoutPath: project.checkoutPath,
    addedAt: project.addedAt,
    contract: {
      passed: project.contract.passed,
      missingSlots: project.contract.missingSlots,
      missingKeys: project.contract.missingKeys,
    },
  };
}
