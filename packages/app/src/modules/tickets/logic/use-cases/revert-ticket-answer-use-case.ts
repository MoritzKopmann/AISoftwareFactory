import type { EventPublisher } from '../../../../shared/event-bus.js';
import { TicketNotAnswerableError } from '../errors/ticket-not-answerable-error.js';
import type { RegisteredRepositories } from '../ports/registered-repositories.js';
import type { TicketStatusWrites } from '../ports/ticket-status-writes.js';

export type RevertTicketAnswerDependencies = {
  readonly ticketStatusWrites: TicketStatusWrites;
  readonly registeredRepositories: RegisteredRepositories;
  readonly events: EventPublisher;
};

export class RevertTicketAnswerUseCase {
  constructor(private readonly dependencies: RevertTicketAnswerDependencies) {}

  async execute(projectId: string, ticketNumber: number): Promise<void> {
    const { ticketStatusWrites, registeredRepositories, events } = this.dependencies;

    const project = (await registeredRepositories.list()).find(
      (registered) => registered.projectId === projectId,
    );
    if (project === undefined) {
      throw new TicketNotAnswerableError(`${projectId} is unknown`);
    }
    const live = await ticketStatusWrites.readState(project.repository, ticketNumber);
    await ticketStatusWrites.setSecondaryState(project.repository, ticketNumber, 'waiting', true);
    events.emit('ticket.status-written', {
      projectId,
      ticketNumber,
      from: live.status,
      to: live.status,
      waiting: true,
      stuck: live.stuck,
    });
  }
}
