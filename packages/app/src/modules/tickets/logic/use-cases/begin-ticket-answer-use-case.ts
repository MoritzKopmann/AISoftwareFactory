import type { EventPublisher } from '../../../../shared/bus/event-publisher.js';
import { TicketNotAnswerableError } from '../errors/ticket-not-answerable-error.js';
import type { RegisteredRepositories } from '../ports/registered-repositories.js';
import type { TicketStatusWrites } from '../ports/ticket-status-writes.js';

export type BeginTicketAnswerDependencies = {
  readonly ticketStatusWrites: TicketStatusWrites;
  readonly registeredRepositories: RegisteredRepositories;
  readonly events: EventPublisher;
};

export class BeginTicketAnswerUseCase {
  constructor(private readonly dependencies: BeginTicketAnswerDependencies) {}

  async execute(projectId: string, ticketNumber: number): Promise<void> {
    const { ticketStatusWrites, registeredRepositories, events } = this.dependencies;

    const project = (await registeredRepositories.list()).find(
      (registered) => registered.projectId === projectId,
    );
    if (project === undefined) {
      throw new TicketNotAnswerableError(`${projectId} is unknown`);
    }
    if ((await ticketStatusWrites.readStatus(project.repository, ticketNumber)) !== 'waiting') {
      throw new TicketNotAnswerableError(`#${ticketNumber} is not waiting`);
    }
    await ticketStatusWrites.setStatus(project.repository, ticketNumber, 'in-progress');
    events.emit('ticket.status-written', {
      projectId,
      ticketNumber,
      from: 'waiting',
      to: 'in-progress',
    });
  }
}
