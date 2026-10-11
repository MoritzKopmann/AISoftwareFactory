import type { EventPublisher } from '../../../../shared/bus/event-publisher.js';
import type { Logger } from '../../../../shared/logger/create-logger.js';
import { decideRunEndTransition } from '../domain/functions/decide-run-end-transition.js';
import type { WaitingRun } from '../domain/types/waiting-run.js';
import type { RegisteredRepositories } from '../ports/registered-repositories.js';
import type { TicketStatusWrites } from '../ports/ticket-status-writes.js';

export type SettleWaitingRunDependencies = {
  readonly ticketStatusWrites: TicketStatusWrites;
  readonly registeredRepositories: RegisteredRepositories;
  readonly events: EventPublisher;
  readonly logger: Logger;
};

export class SettleWaitingRunUseCase {
  constructor(private readonly dependencies: SettleWaitingRunDependencies) {}

  async execute(waitingRun: WaitingRun): Promise<void> {
    const { ticketStatusWrites, registeredRepositories, events, logger } = this.dependencies;
    const { runId, projectId, ticketNumber, wait } = waitingRun;

    const project = (await registeredRepositories.list()).find(
      (registered) => registered.projectId === projectId,
    );
    if (project === undefined) {
      logger.warn(
        `Run ${runId} waits but ${projectId} is unknown, so #${ticketNumber} is unchanged`,
      );
      return;
    }

    // The run is still running: the same end rule applies, but nothing is settled.
    const live = await ticketStatusWrites.readState(project.repository, ticketNumber);
    const transition = decideRunEndTransition(wait, live);
    if (transition.kind === 'none') {
      return;
    }
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
  }
}
