import { determineRunAvailability } from '../domain/functions/determine-run-availability.js';
import type { RunAvailability } from '../domain/types/run-availability.js';
import type { ProjectLookup } from '../ports/project-lookup.js';
import type { RunnerPort } from '../ports/runner-port.js';
import type { RunsGate } from '../ports/runs-gate.js';
import type { TicketLookup } from '../ports/ticket-lookup.js';

export type ReadRunAvailabilityDependencies = {
  readonly ticketLookup: TicketLookup;
  readonly runner: RunnerPort;
  readonly runsGate: RunsGate;
  readonly projectLookup: ProjectLookup;
};

export class ReadRunAvailabilityUseCase {
  constructor(private readonly dependencies: ReadRunAvailabilityDependencies) {}

  async execute(projectId: string, ticketNumber: number): Promise<RunAvailability> {
    const { ticketLookup, runner, runsGate, projectLookup } = this.dependencies;

    const [ticket, activeRun, latestRun, project] = await Promise.all([
      ticketLookup.find(projectId, ticketNumber),
      runner.activeRun(projectId),
      runner.latestRun(projectId, ticketNumber),
      projectLookup.find(projectId),
    ]);

    const lastRunEndedAt = latestRun?.endedAt;
    return determineRunAvailability({
      ...(ticket === undefined ? {} : { ticket }),
      ...(activeRun === undefined ? {} : { activeRun: activeRun.run }),
      ...(lastRunEndedAt === undefined ? {} : { lastRunEndedAt }),
      runsBlocked: runsGate.check(),
      projectOnboarded: project?.onboarded === true,
    });
  }
}
