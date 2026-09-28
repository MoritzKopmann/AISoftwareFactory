import type { ProjectResponse } from '@aisf/app/api-schemas/projects-schemas.js';
import { ContractReport } from './contract-report.js';

type ProjectPageProps = {
  readonly id: string;
  readonly project: ProjectResponse | undefined;
};

export function ProjectPage({ id, project }: ProjectPageProps) {
  if (project === undefined) {
    return (
      <main className="page">
        <p role="alert">No project {id} is registered.</p>
      </main>
    );
  }

  return (
    <main className="page">
      <h2 className="mono">{project.id}</h2>
      <p className="mono muted">{project.checkoutPath}</p>
      <ContractReport report={project.contract} />
    </main>
  );
}
