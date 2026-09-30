import { Hono } from 'hono';
import type { EventSubscriber } from '../../shared/bus/event-subscriber.js';
import type { Logger } from '../../shared/logger/create-logger.js';
import { createRunRoutes } from './api/routes/create-run-routes.js';
import { subscribeToRunFinished } from './api/subscriptions/subscribe-to-run-finished.js';
import { subscribeToSnapshotChanged } from './api/subscriptions/subscribe-to-snapshot-changed.js';
import { RunAlreadyActiveError } from './logic/errors/run-already-active-error.js';
import { RunNotAvailableError } from './logic/errors/run-not-available-error.js';
import type { ProjectLookup } from './logic/ports/project-lookup.js';
import type { PullRequestMerges } from './logic/ports/pull-request-merges.js';
import type { ReviewedTicketLookup } from './logic/ports/reviewed-ticket-lookup.js';
import type { RunnerPort } from './logic/ports/runner-port.js';
import type { RunsGate } from './logic/ports/runs-gate.js';
import type { TicketLookup } from './logic/ports/ticket-lookup.js';
import type { TicketStatusWrites } from './logic/ports/ticket-status-writes.js';
import { MergeApprovedPullRequestsUseCase } from './logic/use-cases/merge-approved-pull-requests-use-case.js';
import { ReadRunAvailabilityUseCase } from './logic/use-cases/read-run-availability-use-case.js';
import { ReadTicketRunUseCase } from './logic/use-cases/read-ticket-run-use-case.js';
import { SettleFinishedRunUseCase } from './logic/use-cases/settle-finished-run-use-case.js';
import { StartTicketRunUseCase } from './logic/use-cases/start-ticket-run-use-case.js';

export type { RunsBlocked } from './logic/domain/types/runs-blocked.js';
export type { SchedulableTicket } from './logic/domain/types/schedulable-ticket.js';
export type { StartedRun } from './logic/domain/types/started-run.js';
export type { SchedulerProject } from './logic/ports/project-lookup.js';
export { RunAlreadyActiveError, RunNotAvailableError };

export type SchedulerModuleDependencies = {
  readonly ticketStatusWrites: TicketStatusWrites;
  readonly pullRequestMerges: PullRequestMerges;
  readonly runner: RunnerPort;
  readonly ticketLookup: TicketLookup;
  readonly reviewedTicketLookup: ReviewedTicketLookup;
  readonly runsGate: RunsGate;
  readonly projectLookup: ProjectLookup;
  readonly subscriber: EventSubscriber;
  readonly logger: Logger;
};

export type SchedulerModule = {
  readonly start: () => void;
  readonly routes: Hono;
};

export function createSchedulerModule(dependencies: SchedulerModuleDependencies): SchedulerModule {
  const {
    ticketStatusWrites,
    pullRequestMerges,
    runner,
    ticketLookup,
    reviewedTicketLookup,
    runsGate,
    projectLookup,
    subscriber,
    logger,
  } = dependencies;

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
  const readTicketRun = new ReadTicketRunUseCase({
    readRunAvailability: (projectId, ticketNumber) =>
      readRunAvailability.execute(projectId, ticketNumber),
    runner,
  });
  const settleFinishedRun = new SettleFinishedRunUseCase({
    ticketStatusWrites,
    runner,
    projectLookup,
    logger,
  });
  const mergeApprovedPullRequests = new MergeApprovedPullRequestsUseCase({
    pullRequestMerges,
    runner,
    reviewedTicketLookup,
    projectLookup,
    logger,
  });

  return {
    routes: new Hono().route(
      '/projects',
      createRunRoutes({
        read: (projectId, ticketNumber) => readTicketRun.execute(projectId, ticketNumber),
        start: (projectId, ticketNumber) => startTicketRun.execute(projectId, ticketNumber),
      }),
    ),
    start: () => {
      subscribeToRunFinished(subscriber, settleFinishedRun, logger);
      subscribeToSnapshotChanged(subscriber, mergeApprovedPullRequests, logger);
    },
  };
}
