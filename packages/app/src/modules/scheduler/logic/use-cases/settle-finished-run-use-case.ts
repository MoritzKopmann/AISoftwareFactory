import type { Logger } from '../../../../shared/logger/create-logger.js';
import { decideRunEndTransition } from '../domain/functions/decide-run-end-transition.js';
import type { FinishedRun } from '../domain/types/finished-run.js';
import type { ProjectLookup } from '../ports/project-lookup.js';
import type { RunnerPort } from '../ports/runner-port.js';
import type { TicketStatusWrites } from '../ports/ticket-status-writes.js';

export type SettleFinishedRunDependencies = {
  readonly ticketStatusWrites: TicketStatusWrites;
  readonly runner: RunnerPort;
  readonly projectLookup: ProjectLookup;
  readonly logger: Logger;
};

export class SettleFinishedRunUseCase {
  constructor(private readonly dependencies: SettleFinishedRunDependencies) {}

  async execute(finishedRun: FinishedRun): Promise<void> {
    const { ticketStatusWrites, runner, projectLookup, logger } = this.dependencies;
    const { runId, projectId, ticketNumber, ending } = finishedRun;

    const project = await projectLookup.find(projectId);
    if (project === undefined) {
      logger.warn(
        `Run ${runId} ended but ${projectId} is unknown, so #${ticketNumber} is unchanged`,
      );
      await runner.settle(runId);
      return;
    }

    const liveStatus = await ticketStatusWrites.readStatus(project.repository, ticketNumber);
    const transition = decideRunEndTransition(ending, liveStatus);
    if (transition.kind === 'transition') {
      await ticketStatusWrites.setStatus(project.repository, ticketNumber, transition.to);
      if (transition.comment !== undefined) {
        await ticketStatusWrites.comment(project.repository, ticketNumber, transition.comment);
      }
    }
    await runner.settle(runId);
  }
}
