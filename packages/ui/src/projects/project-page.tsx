import type { LiveUpdates } from '../live/live-updates.js';
import type { ProjectResponse } from '@aisf/app/api-schemas/projects-schemas.js';
import { Board, BoardSkeleton } from '../board/board.js';
import { describeBoard } from '../board/describe-board.js';
import { describeUpdatedTime } from '../board/describe-updated-time.js';
import { formatAbsoluteTime } from '../board/format-absolute-time.js';
import { useGatedSkeleton } from '../board/use-gated-skeleton.js';
import { useProjectBoard } from '../board/use-project-board.js';
import { KnownBugs } from '../findings/known-bugs.js';
import { Banner } from '../shared/banner.js';
import { ContractReport } from './contract-report.js';

type ProjectPageProps = {
  readonly liveUpdates: LiveUpdates;
  readonly id: string;
  readonly project: ProjectResponse | undefined;
};

export function ProjectPage({ liveUpdates, id, project }: ProjectPageProps) {
  if (project === undefined) {
    return (
      <main className="page">
        <p role="alert">No project {id} is registered.</p>
      </main>
    );
  }
  return <RegisteredProjectPage liveUpdates={liveUpdates} project={project} />;
}

function RegisteredProjectPage({
  liveUpdates,
  project,
}: {
  readonly liveUpdates: LiveUpdates;
  readonly project: ProjectResponse;
}) {
  const { state, now, polledAt, retry } = useProjectBoard(liveUpdates, project.id);
  const board = describeBoard(state, project.id, polledAt);
  const skeletonVisible = useGatedSkeleton(board.loading);
  const { banner, updatedAt } = board;

  return (
    <>
      {banner !== undefined && (
        <Banner {...banner} {...(banner.retryable === true && { onRetry: retry })} />
      )}
      <main className="page">
        <div className="page-head">
          <h1>{project.repository.name}</h1>
          <span className="sm mono">{project.repository.owner}</span>
          <span className="grow" />
          {updatedAt !== undefined && (
            <time className="updated" dateTime={updatedAt} title={formatAbsoluteTime(updatedAt)}>
              {describeUpdatedTime(updatedAt, now)}
            </time>
          )}
        </div>
        <ContractReport report={project.contract} />
        {skeletonVisible ? (
          <BoardSkeleton />
        ) : (
          <>
            {board.emptyMessage !== undefined && (
              <div className="empty">
                <p>{board.emptyMessage}</p>
                <a
                  className="btn ext"
                  href={`https://github.com/${project.id}/issues/new`}
                  target="_blank"
                  rel="noopener"
                >
                  New ticket
                </a>
              </div>
            )}
            {board.rows.length > 0 && (
              <Board
                rows={board.rows}
                projectId={project.id}
                runningTicketNumbers={board.runningTicketNumbers}
              />
            )}
          </>
        )}
        <KnownBugs liveUpdates={liveUpdates} projectId={project.id} />
      </main>
    </>
  );
}
