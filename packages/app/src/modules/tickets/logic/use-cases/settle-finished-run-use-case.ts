import type { EventPublisher } from '../../../../shared/bus/event-publisher.js';
import type { Logger } from '../../../../shared/logger/create-logger.js';
import { decideRunEndTransition } from '../domain/functions/decide-run-end-transition.js';
import type { FinishedRun } from '../domain/types/finished-run.js';
import type { RegisteredRepositories } from '../ports/registered-repositories.js';
import type { RunSettlement } from '../ports/run-settlement.js';
import type { TicketStatusWrites } from '../ports/ticket-status-writes.js';

export type SettleFinishedRunDependencies = {
  readonly ticketStatusWrites: TicketStatusWrites;
  readonly runSettlement: RunSettlement;
  readonly registeredRepositories: RegisteredRepositories;
  readonly events: EventPublisher;
  readonly logger: Logger;
};

export class SettleFinishedRunUseCase {
  constructor(private readonly dependencies: SettleFinishedRunDependencies) {}

  async execute(finishedRun: FinishedRun): Promise<void> {
    const { ticketStatusWrites, runSettlement, registeredRepositories, events, logger } =
      this.dependencies;
    const { runId, projectId, ticketNumber, ending } = finishedRun;

    const project = (await registeredRepositories.list()).find(
      (registered) => registered.projectId === projectId,
    );
    if (project === undefined) {
      logger.warn(
        `Run ${runId} ended but ${projectId} is unknown, so #${ticketNumber} is unchanged`,
      );
      await runSettlement.settle(runId);
      return;
    }

    const live = await ticketStatusWrites.readState(project.repository, ticketNumber);
    const transition = decideRunEndTransition(ending, live);
    if (transition.kind === 'return-to-ready') {
      await ticketStatusWrites.setStatus(project.repository, ticketNumber, 'ready');
      events.emit('ticket.status-written', {
        projectId,
        ticketNumber,
        from: live.status,
        to: 'ready',
        waiting: live.waiting,
        stuck: live.stuck,
      });
    }
    if (transition.kind === 'flag') {
      const becomesStuck = transition.state === 'stuck';
      if (becomesStuck && live.waiting) {
        await ticketStatusWrites.setSecondaryState(
          project.repository,
          ticketNumber,
          'waiting',
          false,
        );
      }
      await ticketStatusWrites.setSecondaryState(
        project.repository,
        ticketNumber,
        transition.state,
        true,
      );
      events.emit('ticket.status-written', {
        projectId,
        ticketNumber,
        from: live.status,
        to: live.status,
        waiting: !becomesStuck,
        stuck: becomesStuck || live.stuck,
      });
      await ticketStatusWrites.comment(project.repository, ticketNumber, transition.comment);
    }
    await runSettlement.settle(runId);
  }
}
