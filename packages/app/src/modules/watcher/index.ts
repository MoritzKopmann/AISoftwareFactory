import { Hono } from 'hono';
import type { EventSubscriber } from '../../shared/bus/event-subscriber.js';
import { createTicketsRoutes } from './api/routes/create-tickets-routes.js';
import { subscribeToRunFinished } from './api/subscriptions/subscribe-to-run-finished.js';
import { subscribeToTicketStatusWritten } from './api/subscriptions/subscribe-to-ticket-status-written.js';
import { subscribeToProjectAdded } from './api/subscriptions/subscribe-to-project-added.js';
import type { ProjectTicket } from './logic/domain/types/project-ticket.js';
import type { Ticket } from './logic/domain/types/ticket.js';
import type { ActiveRunLookup } from './logic/ports/active-run-lookup.js';
import type { RegisteredRepositories } from './logic/ports/registered-repositories.js';
import { FailWatchesUseCase } from './logic/use-cases/fail-watches-use-case.js';
import {
  PollRepositoriesUseCase,
  type PollRepositoriesDependencies,
} from './logic/use-cases/poll-repositories-use-case.js';
import { ReadOpenTicketsUseCase } from './logic/use-cases/read-open-tickets-use-case.js';
import { ReadProjectBoardUseCase } from './logic/use-cases/read-project-board-use-case.js';
import { ReadTicketUseCase } from './logic/use-cases/read-ticket-use-case.js';
import { RecordStatusWriteUseCase } from './logic/use-cases/record-status-write-use-case.js';
import { WatchRepositoryUseCase } from './logic/use-cases/watch-repository-use-case.js';

export type { BoardRow } from './logic/domain/types/board-row.js';
export type { BoardView } from './logic/domain/types/board-view.js';
export type { ProjectBoard } from './logic/domain/types/project-board.js';
export type { ProjectTicket } from './logic/domain/types/project-ticket.js';
export type { SnapshotDiff } from './logic/domain/types/snapshot-diff.js';
export type { SyncFailureCause, SyncStatus } from './logic/domain/types/sync-status.js';
export type { Ticket } from './logic/domain/types/ticket.js';
export type { TicketSnapshot } from './logic/domain/types/ticket-snapshot.js';
export type { ActiveRunLookup } from './logic/ports/active-run-lookup.js';
export type {
  RegisteredRepositories,
  RegisteredRepository,
} from './logic/ports/registered-repositories.js';

export type WatcherModuleDependencies = PollRepositoriesDependencies & {
  readonly subscriber: EventSubscriber;
  readonly registeredRepositories: RegisteredRepositories;
  readonly activeRunLookup: ActiveRunLookup;
  readonly pollIntervalMilliseconds: number;
};

export type WatcherModule = {
  readonly start: () => Promise<void>;
  readonly stop: () => void;
  readonly routes: Hono;
  readonly openTickets: (projectId: string) => ReadonlyArray<Ticket>;
  readonly ticket: (projectId: string, number: number) => Promise<ProjectTicket | undefined>;
};

export function createWatcherModule(dependencies: WatcherModuleDependencies): WatcherModule {
  const pollRepositories = new PollRepositoriesUseCase(dependencies);
  const failWatches = new FailWatchesUseCase(dependencies);
  const recordStatusWrite = new RecordStatusWriteUseCase(dependencies);
  const watchRepository = new WatchRepositoryUseCase(dependencies);
  const readTicket = new ReadTicketUseCase(dependencies);
  const readProjectBoard = new ReadProjectBoardUseCase(dependencies);
  const readOpenTickets = new ReadOpenTicketsUseCase(dependencies);
  let nextPollTimer: ReturnType<typeof setTimeout> | undefined;
  let unsubscribers: ReadonlyArray<() => void> = [];
  let runningPolls: Promise<void> | undefined;
  let pollRequested = false;
  let stopped = false;

  // The timer callback must never reject, or an unhandled rejection ends the process.
  async function runPoll(): Promise<void> {
    try {
      await pollRepositories.execute();
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

  const ticketReads = {
    board: (projectId: string) => readProjectBoard.execute(projectId),
    ticket: (projectId: string, number: number) => readTicket.execute(projectId, number),
  };

  return {
    routes: new Hono().route('/projects', createTicketsRoutes(ticketReads)),
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
  };
}
