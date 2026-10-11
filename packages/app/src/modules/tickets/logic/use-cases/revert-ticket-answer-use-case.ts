import type { EventPublisher } from '../../../../shared/bus/event-publisher.js';
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
    await ticketStatusWrites.setStatus(project.repository, ticketNumber, 'waiting');
    events.emit('ticket.status-written', {
      projectId,
      ticketNumber,
      from: 'in-progress',
      to: 'waiting',
    });
  }
}
