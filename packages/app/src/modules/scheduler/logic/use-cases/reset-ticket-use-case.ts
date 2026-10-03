import { TicketNotResettableError } from '../errors/ticket-not-resettable-error.js';
import type { ProjectLookup } from '../ports/project-lookup.js';
import type { RunnerPort } from '../ports/runner-port.js';
import type { TicketStatusWrites } from '../ports/ticket-status-writes.js';

export type ResetTicketDependencies = {
  readonly ticketStatusWrites: TicketStatusWrites;
  readonly runner: RunnerPort;
  readonly projectLookup: ProjectLookup;
};

export class ResetTicketUseCase {
  constructor(private readonly dependencies: ResetTicketDependencies) {}

  async execute(projectId: string, ticketNumber: number): Promise<void> {
    const { ticketStatusWrites, runner, projectLookup } = this.dependencies;

    const project = await projectLookup.find(projectId);
    if (project === undefined) {
      throw new TicketNotResettableError(`${projectId} is unknown`);
    }
    const activeRuns = await runner.activeRuns(projectId);
    if (activeRuns.some(({ run }) => run.ticketNumber === ticketNumber)) {
      throw new TicketNotResettableError(`#${ticketNumber} has an active run`);
    }
    const status = await ticketStatusWrites.readStatus(project.repository, ticketNumber);
    if (status !== 'stuck' && status !== 'in-progress') {
      throw new TicketNotResettableError(`#${ticketNumber} is not stuck or in progress`);
    }

    await ticketStatusWrites.setStatus(project.repository, ticketNumber, 'ready');
  }
}
