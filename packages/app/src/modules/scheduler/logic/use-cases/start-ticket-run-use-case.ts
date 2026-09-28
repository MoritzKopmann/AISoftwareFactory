import { RunNotAvailableError } from '../errors/run-not-available-error.js';
import type { RunnerPort } from '../ports/runner-port.js';
import type { RunAvailability } from '../domain/types/run-availability.js';
import type { StartedRun } from '../domain/types/started-run.js';

export type StartTicketRunDependencies = {
  readonly readRunAvailability: (
    projectId: string,
    ticketNumber: number,
  ) => Promise<RunAvailability>;
  readonly runner: RunnerPort;
};

export class StartTicketRunUseCase {
  constructor(private readonly dependencies: StartTicketRunDependencies) {}

  async execute(projectId: string, ticketNumber: number): Promise<StartedRun> {
    const availability = await this.dependencies.readRunAvailability(projectId, ticketNumber);
    if (availability.kind === 'absent') {
      throw new RunNotAvailableError(`Ticket #${ticketNumber} cannot be run`);
    }
    if (availability.kind === 'disabled') {
      throw new RunNotAvailableError(availability.reason);
    }
    return this.dependencies.runner.start({ projectId, ticketNumber });
  }
}
