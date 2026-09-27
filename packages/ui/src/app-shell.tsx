import { useEffect, useState } from 'react';
import type { ProjectResponse } from '@aisf/app/api-schemas/projects-schemas.js';
import { SkillsStatusPanel } from './skills/skills-status-panel.js';
import { parseAppRoute, type AppRoute } from './app-route.js';
import { ProjectTabs } from './projects/project-tabs.js';
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
    const handleHashChange = () => setRoute(readRoute());
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

  return (
    <>
      <header>
        <h1>aisf</h1>
        <SkillsStatusPanel />
      </header>
      {projects !== undefined && (
        <ProjectTabs
          projects={projects}
          currentProjectId={route.kind === 'project' ? route.id : undefined}
          addProjectActive={route.kind === 'add-project'}
        />
      )}
      <main>
        {loadFailed && <p role="alert">Projects could not be loaded.</p>}
        {!loadFailed && projects === undefined && <p role="status">Loading projects…</p>}
        {!loadFailed &&
          projects !== undefined &&
          route.kind === 'home' &&
          projects.length === 0 && <p>No projects yet. Add a checkout with +.</p>}
        {route.kind === 'add-project' && <AddProjectForm onAdded={handleAdded} />}
        {route.kind === 'project' && (
          <ProjectPage
            id={route.id}
            project={projects?.find((project) => project.id === route.id)}
          />
        )}
      </main>
    </>
  );
}
