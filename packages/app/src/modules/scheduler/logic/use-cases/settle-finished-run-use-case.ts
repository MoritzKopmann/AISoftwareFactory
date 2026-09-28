import type { Logger } from '../../../../shared/logger/create-logger.js';
import { decideRunEndTransition } from '../domain/functions/decide-run-end-transition.js';
import type { FinishedRun } from '../domain/types/finished-run.js';
import type { GitHubWrites } from '../ports/github-writes.js';
import type { ProjectLookup } from '../ports/project-lookup.js';
import type { RunnerPort } from '../ports/runner-port.js';

export type SettleFinishedRunDependencies = {
  readonly gitHubWrites: GitHubWrites;
  readonly runner: RunnerPort;
  readonly projectLookup: ProjectLookup;
  readonly logger: Logger;
};

export class SettleFinishedRunUseCase {
  constructor(private readonly dependencies: SettleFinishedRunDependencies) {}

  async execute(finishedRun: FinishedRun): Promise<void> {
    const { gitHubWrites, runner, projectLookup, logger } = this.dependencies;
    const { runId, projectId, ticketNumber, ending } = finishedRun;

    const project = await projectLookup.find(projectId);
    if (project === undefined) {
      logger.warn(
        `Run ${runId} ended but ${projectId} is unknown, so #${ticketNumber} is unchanged`,
      );
      await runner.settle(runId);
      return;
    }

    const liveStatus = await gitHubWrites.readStatus(project.repository, ticketNumber);
    const transition = decideRunEndTransition(ending, liveStatus);
    if (transition.kind === 'transition') {
      const outcome = await gitHubWrites.transitionStatus(
        project.repository,
        ticketNumber,
        transition.allowedFrom,
        transition.to,
      );
      if (outcome.kind === 'mismatch') {
        logger.warn(
          `Run ${runId} ended but #${ticketNumber} has statuses [${outcome.actualStatuses.join(', ')}], so nothing was written`,
        );
      } else if (transition.comment !== undefined) {
        await gitHubWrites.comment(project.repository, ticketNumber, transition.comment);
      }
    }
    await runner.settle(runId);
  }
}
