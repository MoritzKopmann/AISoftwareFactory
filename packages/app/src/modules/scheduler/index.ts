import type { EventSubscriber } from '../../shared/bus/event-subscriber.js';
import type { Logger } from '../../shared/logger/create-logger.js';
import { subscribeToRunFinished } from './api/subscriptions/subscribe-to-run-finished.js';
import type { RunAvailability } from './logic/domain/types/run-availability.js';
import { RunNotAvailableError } from './logic/errors/run-not-available-error.js';
import type { GitHubWrites } from './logic/ports/github-writes.js';
import type { ProjectLookup } from './logic/ports/project-lookup.js';
import type { RunnerPort } from './logic/ports/runner-port.js';
import type { RunsGate } from './logic/ports/runs-gate.js';
import type { TicketLookup } from './logic/ports/ticket-lookup.js';
import { ReadRunAvailabilityUseCase } from './logic/use-cases/read-run-availability-use-case.js';
import { SettleFinishedRunUseCase } from './logic/use-cases/settle-finished-run-use-case.js';
import { StartTicketRunUseCase } from './logic/use-cases/start-ticket-run-use-case.js';

export type { RunAvailability } from './logic/domain/types/run-availability.js';
export type { RunsBlocked } from './logic/domain/types/runs-blocked.js';
export type { SchedulableTicket } from './logic/domain/types/schedulable-ticket.js';
export type { TicketStatus } from './logic/domain/types/ticket-status.js';
export type { SchedulerProject } from './logic/ports/project-lookup.js';
export { RunNotAvailableError };

export type SchedulerModuleDependencies = {
  readonly gitHubWrites: GitHubWrites;
  readonly runner: RunnerPort;
  readonly ticketLookup: TicketLookup;
  readonly runsGate: RunsGate;
  readonly projectLookup: ProjectLookup;
  readonly subscriber: EventSubscriber;
  readonly logger: Logger;
};

export type SchedulerModule = {
  readonly start: () => void;
  readonly startRun: (projectId: string, ticketNumber: number) => Promise<void>;
  readonly runAvailability: (projectId: string, ticketNumber: number) => Promise<RunAvailability>;
};

export function createSchedulerModule(dependencies: SchedulerModuleDependencies): SchedulerModule {
  const { gitHubWrites, runner, ticketLookup, runsGate, projectLookup, subscriber, logger } =
    dependencies;

  const readRunAvailability = new ReadRunAvailabilityUseCase({
    ticketLookup,
    runner,
    runsGate,
    projectLookup,
  });
  const startTicketRun = new StartTicketRunUseCase({
    readRunAvailability: (projectId, ticketNumber) =>
      readRunAvailability.execute(projectId, ticketNumber),
    runner,
  });
  const settleFinishedRun = new SettleFinishedRunUseCase({
    gitHubWrites,
    runner,
    projectLookup,
    logger,
  });

  return {
    start: () => {
      subscribeToRunFinished(subscriber, settleFinishedRun, logger);
    },
    startRun: (projectId, ticketNumber) => startTicketRun.execute(projectId, ticketNumber),
    runAvailability: (projectId, ticketNumber) =>
      readRunAvailability.execute(projectId, ticketNumber),
  };
}
