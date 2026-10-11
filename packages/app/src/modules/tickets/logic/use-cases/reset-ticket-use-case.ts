import type { EventPublisher } from '../../../../shared/bus/event-publisher.js';
import { TicketNotResettableError } from '../errors/ticket-not-resettable-error.js';
import type { ActiveRunLookup } from '../ports/active-run-lookup.js';
import type { RegisteredRepositories } from '../ports/registered-repositories.js';
import type { TicketStatusWrites } from '../ports/ticket-status-writes.js';

export type ResetTicketDependencies = {
  readonly ticketStatusWrites: TicketStatusWrites;
  readonly activeRunLookup: ActiveRunLookup;
  readonly registeredRepositories: RegisteredRepositories;
  readonly events: EventPublisher;
};

export class ResetTicketUseCase {
  constructor(private readonly dependencies: ResetTicketDependencies) {}

  async execute(projectId: string, ticketNumber: number): Promise<void> {
    const { ticketStatusWrites, activeRunLookup, registeredRepositories, events } =
      this.dependencies;

    const project = (await registeredRepositories.list()).find(
      (registered) => registered.projectId === projectId,
    );
    if (project === undefined) {
      throw new TicketNotResettableError(`${projectId} is unknown`);
    }
    if ((await activeRunLookup.activeRunTicketNumbers(projectId)).includes(ticketNumber)) {
      throw new TicketNotResettableError(`#${ticketNumber} has an active run`);
    }
    const live = await ticketStatusWrites.readState(project.repository, ticketNumber);
    if (live.status !== 'in-progress' && !live.stuck) {
      throw new TicketNotResettableError(`#${ticketNumber} is not stuck or in progress`);
    }

    // An authoring ticket keeps its status: a failed create or plan run changed nothing.
    const status = live.status === 'idea' || live.status === 'plan' ? live.status : 'ready';
    if (status === 'ready') {
      await ticketStatusWrites.setStatus(project.repository, ticketNumber, 'ready');
    }
    for (const state of ['waiting', 'stuck'] as const) {
      if (live[state]) {
        await ticketStatusWrites.setSecondaryState(project.repository, ticketNumber, state, false);
      }
    }
    events.emit('ticket.status-written', {
      projectId,
      ticketNumber,
      from: live.status,
      to: status,
      waiting: false,
      stuck: false,
    });
  }
}
