import type { EventSubscriber } from '../../shared/bus/event-subscriber.js';
import type { Clock } from '../../shared/clock/clock.js';
import type { Logger } from '../../shared/logger/create-logger.js';
import type { RunTool } from '../runner/index.js';
import { subscribeToRunFinished } from './api/subscriptions/subscribe-to-run-finished.js';
import { subscribeToSnapshotChanged } from './api/subscriptions/subscribe-to-snapshot-changed.js';
import { createReportFindingTool } from './api/tools/create-report-finding-tool.js';
import type { Finding } from './logic/domain/types/finding.js';
import type { RunAvailability } from './logic/domain/types/run-availability.js';
import type { StartedRun } from './logic/domain/types/started-run.js';
import { FindingNotFoundError } from './logic/errors/finding-not-found-error.js';
import { FindingNotOpenError } from './logic/errors/finding-not-open-error.js';
import { RunNotAvailableError } from './logic/errors/run-not-available-error.js';
import type { FindingRepository } from './logic/ports/finding-repository.js';
import type { GitHubWrites } from './logic/ports/github-writes.js';
import type { ProjectLookup } from './logic/ports/project-lookup.js';
import type { ReviewedTicketLookup } from './logic/ports/reviewed-ticket-lookup.js';
import type { RunnerPort } from './logic/ports/runner-port.js';
import type { RunsGate } from './logic/ports/runs-gate.js';
import type { TicketLookup } from './logic/ports/ticket-lookup.js';
import { CreateTicketFromFindingUseCase } from './logic/use-cases/create-ticket-from-finding-use-case.js';
import { DismissFindingUseCase } from './logic/use-cases/dismiss-finding-use-case.js';
import { ListFindingsUseCase } from './logic/use-cases/list-findings-use-case.js';
import { MergeApprovedPullRequestsUseCase } from './logic/use-cases/merge-approved-pull-requests-use-case.js';
import { ReadRunAvailabilityUseCase } from './logic/use-cases/read-run-availability-use-case.js';
import { ReportFindingUseCase } from './logic/use-cases/report-finding-use-case.js';
import { SettleFinishedRunUseCase } from './logic/use-cases/settle-finished-run-use-case.js';
import { StartTicketRunUseCase } from './logic/use-cases/start-ticket-run-use-case.js';

export type { Finding, FindingKind, FindingState } from './logic/domain/types/finding.js';
export type { RunAvailability } from './logic/domain/types/run-availability.js';
export type { StartedRun } from './logic/domain/types/started-run.js';
export type { RunsBlocked } from './logic/domain/types/runs-blocked.js';
export type { SchedulableTicket } from './logic/domain/types/schedulable-ticket.js';
export type { SchedulerProject } from './logic/ports/project-lookup.js';
export { FindingNotFoundError, FindingNotOpenError, RunNotAvailableError };

export function createFindingReportingTool(dependencies: {
  readonly findingRepository: FindingRepository;
  readonly clock: Clock;
}): RunTool {
  return createReportFindingTool(new ReportFindingUseCase(dependencies));
}

export type SchedulerModuleDependencies = {
  readonly gitHubWrites: GitHubWrites;
  readonly runner: RunnerPort;
  readonly ticketLookup: TicketLookup;
  readonly reviewedTicketLookup: ReviewedTicketLookup;
  readonly runsGate: RunsGate;
  readonly projectLookup: ProjectLookup;
  readonly findingRepository: FindingRepository;
  readonly clock: Clock;
  readonly subscriber: EventSubscriber;
  readonly logger: Logger;
};

export type SchedulerModule = {
  readonly start: () => void;
  readonly startRun: (projectId: string, ticketNumber: number) => Promise<StartedRun>;
  readonly runAvailability: (projectId: string, ticketNumber: number) => Promise<RunAvailability>;
  readonly listFindings: (
    projectId: string,
    ticketNumber?: number,
  ) => Promise<ReadonlyArray<Finding>>;
  readonly createTicketFromFinding: (projectId: string, findingId: number) => Promise<Finding>;
  readonly dismissFinding: (projectId: string, findingId: number) => Promise<Finding>;
};

export function createSchedulerModule(dependencies: SchedulerModuleDependencies): SchedulerModule {
  const {
    gitHubWrites,
    runner,
    ticketLookup,
    reviewedTicketLookup,
    runsGate,
    projectLookup,
    findingRepository,
    clock,
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
  const settleFinishedRun = new SettleFinishedRunUseCase({
    gitHubWrites,
    runner,
    projectLookup,
    logger,
  });
  const listFindings = new ListFindingsUseCase({ findingRepository });
  const createTicketFromFinding = new CreateTicketFromFindingUseCase({
    findingRepository,
    gitHubWrites,
    projectLookup,
    clock,
  });
  const dismissFinding = new DismissFindingUseCase({ findingRepository, clock });
  const mergeApprovedPullRequests = new MergeApprovedPullRequestsUseCase({
    gitHubWrites,
    runner,
    reviewedTicketLookup,
    projectLookup,
    logger,
  });

  return {
    start: () => {
      subscribeToRunFinished(subscriber, settleFinishedRun, logger);
      subscribeToSnapshotChanged(subscriber, mergeApprovedPullRequests, logger);
    },
    startRun: (projectId, ticketNumber) => startTicketRun.execute(projectId, ticketNumber),
    runAvailability: (projectId, ticketNumber) =>
      readRunAvailability.execute(projectId, ticketNumber),
    listFindings: (projectId, ticketNumber) => listFindings.execute(projectId, ticketNumber),
    createTicketFromFinding: (projectId, findingId) =>
      createTicketFromFinding.execute(projectId, findingId),
    dismissFinding: (projectId, findingId) => dismissFinding.execute(projectId, findingId),
  };
}
