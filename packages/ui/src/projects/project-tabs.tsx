import type { ProjectResponse } from '@aisf/app/api-schemas/projects-schemas.js';

type ProjectTabsProps = {
  readonly projects: ReadonlyArray<ProjectResponse>;
  readonly currentProjectId: string | undefined;
  readonly addProjectActive: boolean;
};

export function ProjectTabs({ projects, currentProjectId, addProjectActive }: ProjectTabsProps) {
  return (
    <nav className="project-tabs">
      {projects.map((project) => (
        <a
          key={project.id}
          className="mono project-tab"
          href={`#/projects/${project.id}`}
          aria-current={project.id === currentProjectId ? 'page' : undefined}
        >
          {project.id}
        </a>
      ))}
      <a
        className="project-tab project-tab-add"
        href="#/projects/new"
        aria-current={addProjectActive ? 'page' : undefined}
      >
        +
      </a>
    </nav>
  );
}
