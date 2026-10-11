import type { RunAvailability } from '../domain/types/run-availability.js';
import type { RunWait } from '../domain/types/run-wait.js';
import type { TicketRun } from '../domain/types/ticket-run.js';
import type { TicketRunWait } from '../domain/types/ticket-run-wait.js';
import type { RunPageLookup } from '../ports/run-page-lookup.js';
import type { RunnerPort } from '../ports/runner-port.js';

export type ReadTicketRunDependencies = {
  readonly readRunAvailability: (
    projectId: string,
    ticketNumber: number,
  ) => Promise<RunAvailability>;
  readonly runner: RunnerPort;
  readonly runPageLookup: RunPageLookup;
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
    const waitingFor = await this.withPage(projectId, ticketNumber, activeRun?.run.waitingFor);
    return {
      availability,
      ...(activeRun !== undefined
        ? {
            activeRun: {
              id: activeRun.run.id,
              startedAt: activeRun.run.startedAt,
              steps: activeRun.steps,
              ...(waitingFor === undefined ? {} : { waitingFor }),
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

  private async withPage(
    projectId: string,
    ticketNumber: number,
    waitingFor: RunWait | undefined,
  ): Promise<TicketRunWait | undefined> {
    if (waitingFor?.kind !== 'checkpoint' || waitingFor.artifactId === undefined) {
      return waitingFor;
    }
    const page = await this.dependencies.runPageLookup.find(
      projectId,
      ticketNumber,
      waitingFor.artifactId,
    );
    return page === undefined ? waitingFor : { ...waitingFor, page };
  }
}
