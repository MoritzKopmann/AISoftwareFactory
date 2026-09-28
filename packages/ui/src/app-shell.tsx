import { useEffect, useState } from 'react';
import type { ProjectResponse } from '@aisf/app/api-schemas/projects-schemas.js';
import { SkillsStatusPanel } from './skills/skills-status-panel.js';
import { parseAppRoute, type AppRoute } from './app-route.js';
import { ProjectSidebar } from './projects/project-sidebar.js';
import { AddProjectForm } from './projects/add-project-form.js';
import { ProjectPage } from './projects/project-page.js';

function readRoute(): AppRoute {
  return parseAppRoute(window.location.hash);
}

export function AppShell() {
  const [route, setRoute] = useState<AppRoute>(readRoute);
  const [projects, setProjects] = useState<ReadonlyArray<ProjectResponse> | undefined>(undefined);
  const [loadFailed, setLoadFailed] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    const handleHashChange = () => {
      setRoute(readRoute());
      setReloadToken((token) => token + 1);
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const response = await fetch('/api/projects');
        if (!response.ok) {
          throw new Error(`Projects route answered ${response.status}`);
        }
        const loaded = (await response.json()) as ReadonlyArray<ProjectResponse>;
        if (!cancelled) {
          setProjects(loaded);
          setLoadFailed(false);
        }
      } catch {
        if (!cancelled) setLoadFailed(true);
      }
    };
    void load();

    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  const handleAdded = (project: ProjectResponse) => {
    setReloadToken((token) => token + 1);
    window.location.hash = `#/projects/${project.id}`;
  };

  const renderPage = () => {
    if (loadFailed) {
      return <PageMessage role="alert">Projects could not be loaded.</PageMessage>;
    }
    if (projects === undefined) {
      return <PageMessage role="status">Loading projects…</PageMessage>;
    }
    switch (route.kind) {
      case 'home':
        return (
          <main className="page">
            {projects.length === 0 && <p>No projects yet. Add a checkout with +.</p>}
          </main>
        );
      case 'add-project':
        return (
          <main className="page">
            <AddProjectForm onAdded={handleAdded} />
          </main>
        );
      case 'project':
        return (
          <ProjectPage
            id={route.id}
            project={projects.find((project) => project.id === route.id)}
          />
        );
      case 'ticket':
        return null;
    }
  };

  return (
    <div className="shell">
      <ProjectSidebar projects={projects} route={route} />
      <div className="main">
        <SkillsStatusPanel />
        {renderPage()}
      </div>
    </div>
  );
}

function PageMessage({
  role,
  children,
}: {
  readonly role: 'alert' | 'status';
  readonly children: string;
}) {
  return (
    <main className="page">
      <p role={role}>{children}</p>
    </main>
  );
}
