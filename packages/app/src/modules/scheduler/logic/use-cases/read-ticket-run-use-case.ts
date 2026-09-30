import type { RunAvailability } from '../domain/types/run-availability.js';
import type { TicketRun } from '../domain/types/ticket-run.js';
import type { RunnerPort } from '../ports/runner-port.js';

export type ReadTicketRunDependencies = {
  readonly readRunAvailability: (
    projectId: string,
    ticketNumber: number,
  ) => Promise<RunAvailability>;
  readonly runner: RunnerPort;
};

export class ReadTicketRunUseCase {
  constructor(private readonly dependencies: ReadTicketRunDependencies) {}

  async execute(projectId: string, ticketNumber: number): Promise<TicketRun> {
    const { readRunAvailability, runner } = this.dependencies;

    const [availability, activeRun, latestRun] = await Promise.all([
      readRunAvailability(projectId, ticketNumber),
      runner.activeRun(projectId),
      runner.latestRun(projectId, ticketNumber),
    ]);

    return {
      availability,
      ...(activeRun?.ticketNumber === ticketNumber
        ? {
            activeRun: {
              id: activeRun.id,
              startedAt: activeRun.startedAt,
              steps: activeRun.steps,
            },
          }
        : {}),
      ...(latestRun?.ending !== undefined && latestRun.endedAt !== undefined
        ? {
            lastRun: {
              id: latestRun.id,
              startedAt: latestRun.startedAt,
              endedAt: latestRun.endedAt,
              ending: latestRun.ending,
            },
          }
        : {}),
    };
  }
}
