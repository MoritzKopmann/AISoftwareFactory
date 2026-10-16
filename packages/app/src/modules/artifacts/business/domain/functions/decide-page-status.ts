import type { Artifact } from '../types/artifact.js';
import type { PageStatus } from '../types/page-status.js';
import type { TicketLatestRun } from '../types/ticket-latest-run.js';

export function decidePageStatus(
  artifact: Artifact,
  latestRun: TicketLatestRun | undefined,
): PageStatus {
  if (latestRun === undefined) {
    return 'closed';
  }
  if (latestRun.id !== artifact.runId) {
    return latestRun.state === 'running' ? 'busy' : 'closed';
  }
  const waitsHere =
    latestRun.state === 'running' && latestRun.waitingFor?.artifactId === artifact.artifactId;
  const endedHere =
    latestRun.state !== 'running' &&
    latestRun.ending?.kind === 'checkpoint' &&
    latestRun.ending.artifactId === artifact.artifactId;
  return waitsHere || endedHere ? 'open' : 'closed';
}
