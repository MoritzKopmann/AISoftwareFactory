import { Hono } from 'hono';
import type { EventSubscriber } from '../../shared/bus/event-subscriber.js';
import type { Logger } from '../../shared/logger/create-logger.js';
import { createNeedsYouRoutes } from './api/routes/create-needs-you-routes.js';
import { createTicketResetRoutes } from './api/routes/create-ticket-reset-routes.js';
import { createTicketsRoutes } from './api/routes/create-tickets-routes.js';
import { subscribeToRunFinished } from './api/subscriptions/subscribe-to-run-finished.js';
import { subscribeToRunFinishedSettlement } from './api/subscriptions/subscribe-to-run-finished-settlement.js';
import { subscribeToRunWaiting } from './api/subscriptions/subscribe-to-run-waiting.js';
import { subscribeToTicketStatusWritten } from './api/subscriptions/subscribe-to-ticket-status-written.js';
import { subscribeToProjectAdded } from './api/subscriptions/subscribe-to-project-added.js';
import type { ProjectTicket } from './logic/domain/types/project-ticket.js';
import type { RepositoryReference } from './logic/domain/types/repository-reference.js';
import type { Ticket } from './logic/domain/types/ticket.js';
import type { ActiveRunLookup } from './logic/ports/active-run-lookup.js';
import type { IdeaCreation } from './logic/ports/idea-creation.js';
import type { RegisteredRepositories } from './logic/ports/registered-repositories.js';
import type { RunWaitLookup } from './logic/ports/run-wait-lookup.js';
import type { RunSettlement } from './logic/ports/run-settlement.js';
import type { TicketStatusWrites } from './logic/ports/ticket-status-writes.js';
import { BeginTicketAnswerUseCase } from './logic/use-cases/begin-ticket-answer-use-case.js';
import { CreateIdeaUseCase } from './logic/use-cases/create-idea-use-case.js';
import { FailWatchesUseCase } from './logic/use-cases/fail-watches-use-case.js';
import {
  PollRepositoriesUseCase,
  type PollRepositoriesDependencies,
} from './logic/use-cases/poll-repositories-use-case.js';
import { ReadNeedsYouUseCase } from './logic/use-cases/read-needs-you-use-case.js';
import { ReadOpenTicketsUseCase } from './logic/use-cases/read-open-tickets-use-case.js';
import { ReadProjectBoardUseCase } from './logic/use-cases/read-project-board-use-case.js';
import { ReadTicketUseCase } from './logic/use-cases/read-ticket-use-case.js';
import { RecordStatusWriteUseCase } from './logic/use-cases/record-status-write-use-case.js';
import { ResetTicketUseCase } from './logic/use-cases/reset-ticket-use-case.js';
import { RevertTicketAnswerUseCase } from './logic/use-cases/revert-ticket-answer-use-case.js';
import { SettleFinishedRunUseCase } from './logic/use-cases/settle-finished-run-use-case.js';
import { SettleWaitingRunUseCase } from './logic/use-cases/settle-waiting-run-use-case.js';
import { WatchRepositoryUseCase } from './logic/use-cases/watch-repository-use-case.js';

export type { BoardRow } from './logic/domain/types/board-row.js';
export type { BoardView } from './logic/domain/types/board-view.js';
export type { NeedsYouRow } from './logic/domain/types/needs-you-row.js';
export type { ProjectBoard } from './logic/domain/types/project-board.js';
export type { ProjectTicket } from './logic/domain/types/project-ticket.js';
export type { SnapshotDiff } from './logic/domain/types/snapshot-diff.js';
export type { SyncFailureCause, SyncStatus } from './logic/domain/types/sync-status.js';
export type { Ticket } from './logic/domain/types/ticket.js';
export type { TicketSnapshot } from './logic/domain/types/ticket-snapshot.js';
export { TicketNotAnswerableError } from './logic/errors/ticket-not-answerable-error.js';
export type { RunSettlement } from './logic/ports/run-settlement.js';
export type { RunWait, RunWaitLookup } from './logic/ports/run-wait-lookup.js';
export type { ActiveRunLookup } from './logic/ports/active-run-lookup.js';
export type {
  RegisteredRepositories,
  RegisteredRepository,
} from './logic/ports/registered-repositories.js';

export type TicketsModuleDependencies = PollRepositoriesDependencies & {
  readonly subscriber: EventSubscriber;
  readonly ideaCreation: IdeaCreation;
  readonly registeredRepositories: RegisteredRepositories;
  readonly activeRunLookup: ActiveRunLookup;
  readonly runWaitLookup: RunWaitLookup;
  readonly ticketStatusWrites: TicketStatusWrites;
  readonly runSettlement: RunSettlement;
  readonly logger: Logger;
  readonly pollIntervalMilliseconds: number;
};

export type TicketsModule = {
  readonly start: () => Promise<void>;
  readonly stop: () => void;
  readonly routes: Hono;
  readonly openTickets: (projectId: string) => ReadonlyArray<Ticket>;
  readonly ticket: (projectId: string, number: number) => Promise<ProjectTicket | undefined>;
  readonly beginAnswer: (projectId: string, ticketNumber: number) => Promise<void>;
  readonly revertAnswer: (projectId: string, ticketNumber: number) => Promise<void>;
  readonly createIdea: (
    repository: RepositoryReference,
    idea: { readonly title: string; readonly body: string },
  ) => Promise<number>;
};

export function createTicketsModule(dependencies: TicketsModuleDependencies): TicketsModule {
  const pollRepositories = new PollRepositoriesUseCase(dependencies);
  const failWatches = new FailWatchesUseCase(dependencies);
  const recordStatusWrite = new RecordStatusWriteUseCase(dependencies);
  const watchRepository = new WatchRepositoryUseCase(dependencies);
  const readTicket = new ReadTicketUseCase(dependencies);
  const readProjectBoard = new ReadProjectBoardUseCase(dependencies);
  const readNeedsYou = new ReadNeedsYouUseCase(dependencies);
  const readOpenTickets = new ReadOpenTicketsUseCase(dependencies);
  const settleFinishedRun = new SettleFinishedRunUseCase(dependencies);
  const settleWaitingRun = new SettleWaitingRunUseCase(dependencies);
  const resetTicket = new ResetTicketUseCase(dependencies);
  const beginTicketAnswer = new BeginTicketAnswerUseCase(dependencies);
  const revertTicketAnswer = new RevertTicketAnswerUseCase(dependencies);
  let nextPollTimer: ReturnType<typeof setTimeout> | undefined;
  let unsubscribers: ReadonlyArray<() => void> = [];
  let runningPolls: Promise<void> | undefined;
  let pollRequested = false;
  const forcedRepositories: RepositoryReference[] = [];
  let stopped = false;

  // The timer callback must never reject, or an unhandled rejection ends the process.
  async function runPoll(): Promise<void> {
    try {
      await pollRepositories.execute(forcedRepositories.splice(0));
    } catch (error) {
      failWatches.execute(error);
    }
  }

  function scheduleNextPoll(): void {
    if (stopped) {
      return;
    }
    nextPollTimer = setTimeout(() => {
      void requestPoll();
    }, dependencies.pollIntervalMilliseconds);
    nextPollTimer.unref();
  }

  function requestPoll(): Promise<void> {
    if (runningPolls !== undefined) {
      pollRequested = true;
      return runningPolls;
    }
    clearTimeout(nextPollTimer);
    runningPolls = (async () => {
      do {
        pollRequested = false;
        await runPoll();
      } while (pollRequested && !stopped);
      runningPolls = undefined;
      scheduleNextPoll();
    })();
    return runningPolls;
  }

  const createIdea = new CreateIdeaUseCase({
    ideaCreation: dependencies.ideaCreation,
    // Joins the poll loop, so a snapshot never overlaps the timer poll.
    refreshSnapshot: (repository) => {
      forcedRepositories.push(repository);
      return requestPoll();
    },
  });

  const ticketReads = {
    board: (projectId: string) => readProjectBoard.execute(projectId),
    ticket: (projectId: string, number: number) => readTicket.execute(projectId, number),
  };

  return {
    routes: new Hono()
      .route('/projects', createTicketsRoutes(ticketReads))
      .route(
        '/projects',
        createNeedsYouRoutes({ read: (projectId) => readNeedsYou.execute(projectId) }),
      )
      .route(
        '/projects',
        createTicketResetRoutes({
          reset: (projectId, ticketNumber) => resetTicket.execute(projectId, ticketNumber),
        }),
      ),
    start: async () => {
      stopped = false;
      unsubscribers = [
        subscribeToProjectAdded(dependencies.subscriber, (projectId, repository) => {
          watchRepository.execute(projectId, repository);
          void requestPoll();
        }),
        subscribeToTicketStatusWritten(dependencies.subscriber, (projectId, write) => {
          recordStatusWrite.execute(projectId, write);
          void requestPoll();
        }),
        subscribeToRunFinished(dependencies.subscriber, () => {
          void requestPoll();
        }),
        subscribeToRunFinishedSettlement(
          dependencies.subscriber,
          settleFinishedRun,
          dependencies.logger,
        ),
        subscribeToRunWaiting(dependencies.subscriber, settleWaitingRun, dependencies.logger),
      ];
      for (const { projectId, repository } of await dependencies.registeredRepositories.list()) {
        watchRepository.execute(projectId, repository);
      }
      await requestPoll();
    },
    stop: () => {
      stopped = true;
      clearTimeout(nextPollTimer);
      for (const unsubscribe of unsubscribers) {
        unsubscribe();
      }
      unsubscribers = [];
    },
    openTickets: (projectId) => readOpenTickets.execute(projectId),
    ticket: ticketReads.ticket,
    beginAnswer: (projectId, ticketNumber) => beginTicketAnswer.execute(projectId, ticketNumber),
    revertAnswer: (projectId, ticketNumber) => revertTicketAnswer.execute(projectId, ticketNumber),
    createIdea: (repository, idea) => createIdea.execute(repository, idea),
  };
}
