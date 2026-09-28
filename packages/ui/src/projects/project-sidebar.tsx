import type { ProjectResponse } from '@aisf/app/api-schemas/projects-schemas.js';
import type { AppRoute } from '../app-route.js';
import { describeSidebarItems } from './describe-sidebar-items.js';

type ProjectSidebarProps = {
  readonly projects: ReadonlyArray<ProjectResponse> | undefined;
  readonly route: AppRoute;
};

export function ProjectSidebar({ projects, route }: ProjectSidebarProps) {
  if (projects === undefined) {
    return (
      <aside className="rail" aria-label="Navigation">
        <div className="brand">aisf</div>
      </aside>
    );
  }

  const description = describeSidebarItems(projects, route);
  return (
    <aside className="rail" aria-label="Navigation">
      <div className="brand">aisf</div>
      <nav className="nav" aria-label="Projects">
        <div className="sec label">Projects</div>
        {description.projects.map((item) => (
          <a
            key={item.id}
            className="item repo"
            href={item.href}
            title={item.title}
            aria-current={item.current ? 'page' : undefined}
          >
            <span className="grow">{item.label}</span>
          </a>
        ))}
        <a
          className="item"
          href={description.addProject.href}
          aria-current={description.addProject.current ? 'page' : undefined}
        >
          <span className="grow">+ Add project</span>
        </a>
      </nav>
    </aside>
  );
}
