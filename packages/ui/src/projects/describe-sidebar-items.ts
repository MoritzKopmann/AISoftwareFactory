import type { ProjectResponse } from '@aisf/app/api-schemas/projects-schemas.js';
import type { AppRoute } from '../app-route.js';

export type SidebarProjectItem = {
  readonly id: string;
  readonly label: string;
  readonly title: string;
  readonly href: string;
  readonly current: boolean;
};

export type SidebarDescription = {
  readonly projects: ReadonlyArray<SidebarProjectItem>;
  readonly addProject: { readonly href: string; readonly current: boolean };
};

export function describeSidebarItems(
  projects: ReadonlyArray<ProjectResponse>,
  route: AppRoute,
): SidebarDescription {
  const currentProjectId =
    route.kind === 'project' || route.kind === 'ticket' ? route.id : undefined;
  return {
    projects: projects.map((project) => ({
      id: project.id,
      label: project.repository.name,
      title: `${project.repository.owner}/${project.repository.name}`,
      href: `#/projects/${project.id}`,
      current: project.id === currentProjectId,
    })),
    addProject: { href: '#/projects/new', current: route.kind === 'add-project' },
  };
}
