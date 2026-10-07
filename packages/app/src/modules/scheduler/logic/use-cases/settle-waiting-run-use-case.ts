import type { EventPublisher } from '../../../../shared/bus/event-publisher.js';
import type { Logger } from '../../../../shared/logger/create-logger.js';
import { decideRunEndTransition } from '../domain/functions/decide-run-end-transition.js';
import type { WaitingRun } from '../domain/types/waiting-run.js';
import type { ProjectLookup } from '../ports/project-lookup.js';
import type { TicketStatusWrites } from '../ports/ticket-status-writes.js';

export type SettleWaitingRunDependencies = {
  readonly ticketStatusWrites: TicketStatusWrites;
  readonly projectLookup: ProjectLookup;
  readonly events: EventPublisher;
  readonly logger: Logger;
};

export class SettleWaitingRunUseCase {
  constructor(private readonly dependencies: SettleWaitingRunDependencies) {}

  async execute(waitingRun: WaitingRun): Promise<void> {
    const { ticketStatusWrites, projectLookup, events, logger } = this.dependencies;
    const { runId, projectId, ticketNumber, wait } = waitingRun;

    const project = await projectLookup.find(projectId);
    if (project === undefined) {
      logger.warn(
        `Run ${runId} waits but ${projectId} is unknown, so #${ticketNumber} is unchanged`,
      );
      return;
    }

    // The run is still running: the same end rule applies, but nothing is settled.
    const liveStatus = await ticketStatusWrites.readStatus(project.repository, ticketNumber);
    const transition = decideRunEndTransition(wait, liveStatus);
    if (transition.kind === 'none') {
      return;
    }
    await ticketStatusWrites.setStatus(project.repository, ticketNumber, transition.to);
    events.emit('ticket.status-written', {
      projectId,
      ticketNumber,
      from: liveStatus,
      to: transition.to,
    });
    if (transition.comment !== undefined) {
      await ticketStatusWrites.comment(project.repository, ticketNumber, transition.comment);
    }
  }
}
