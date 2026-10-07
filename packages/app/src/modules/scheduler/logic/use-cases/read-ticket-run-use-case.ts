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

    const [availability, activeRuns, latestRun] = await Promise.all([
      readRunAvailability(projectId, ticketNumber),
      runner.activeRuns(projectId),
      runner.latestRun(projectId, ticketNumber),
    ]);

    const activeRun = activeRuns.find(({ run }) => run.ticketNumber === ticketNumber);
    return {
      availability,
      ...(activeRun !== undefined
        ? {
            activeRun: {
              id: activeRun.run.id,
              startedAt: activeRun.run.startedAt,
              steps: activeRun.steps,
              ...(activeRun.run.waitingFor === undefined
                ? {}
                : { waitingFor: activeRun.run.waitingFor }),
              ...(activeRun.run.waitingSince === undefined
                ? {}
                : { waitingSince: activeRun.run.waitingSince }),
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
