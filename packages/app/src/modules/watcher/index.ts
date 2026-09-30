import { Hono } from 'hono';
import type { EventSubscriber } from '../../shared/bus/event-subscriber.js';
import { createTicketsRoutes } from './api/routes/create-tickets-routes.js';
import { subscribeToProjectAdded } from './api/subscriptions/subscribe-to-project-added.js';
import { failWatch } from './logic/domain/functions/fail-watch.js';
import type { ProjectTicket } from './logic/domain/types/project-ticket.js';
import type { RepositoryReference } from './logic/domain/types/repository-reference.js';
import type { RepositoryWatch } from './logic/domain/types/repository-watch.js';
import type { Ticket } from './logic/domain/types/ticket.js';
import type { ActiveRunLookup } from './logic/ports/active-run-lookup.js';
import type { RegisteredRepositories } from './logic/ports/registered-repositories.js';
import {
  PollRepositoriesUseCase,
  type PollRepositoriesDependencies,
} from './logic/use-cases/poll-repositories-use-case.js';
import { ReadProjectBoardUseCase } from './logic/use-cases/read-project-board-use-case.js';
import { ReadTicketUseCase } from './logic/use-cases/read-ticket-use-case.js';

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
  const readTicket = new ReadTicketUseCase(dependencies);
  const readProjectBoard = new ReadProjectBoardUseCase(dependencies);
  const watchesByProjectId = new Map<string, RepositoryWatch>();
  let nextPollTimer: ReturnType<typeof setTimeout> | undefined;
  let unsubscribe: (() => void) | undefined;
  let runningPolls: Promise<void> | undefined;
  let pollRequested = false;
  let stopped = false;

  function watchRepository(projectId: string, repository: RepositoryReference): void {
    if (!watchesByProjectId.has(projectId)) {
      watchesByProjectId.set(projectId, { projectId, repository, sync: { state: 'pending' } });
    }
  }

  // The timer callback must never reject, or an unhandled rejection ends the process.
  async function runPoll(): Promise<void> {
    try {
      const polledWatches = await pollRepositories.execute([...watchesByProjectId.values()]);
      for (const watch of polledWatches) {
        watchesByProjectId.set(watch.projectId, watch);
      }
    } catch (error) {
      const failedAt = dependencies.clock.now();
      const message = error instanceof Error ? error.message : String(error);
      for (const watch of [...watchesByProjectId.values()]) {
        watchesByProjectId.set(
          watch.projectId,
          failWatch(watch, { cause: 'unexpected', message, failedAt }),
        );
      }
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
    board: async (projectId: string) => {
      const watch = watchesByProjectId.get(projectId);
      return watch === undefined ? undefined : readProjectBoard.execute(watch);
    },
    ticket: async (projectId: string, number: number) => {
      const watch = watchesByProjectId.get(projectId);
      return watch === undefined ? undefined : readTicket.execute(watch, number);
    },
  };

  return {
    routes: new Hono().route('/projects', createTicketsRoutes(ticketReads)),
    start: async () => {
      stopped = false;
      unsubscribe = subscribeToProjectAdded(dependencies.subscriber, (projectId, repository) => {
        watchRepository(projectId, repository);
        void requestPoll();
      });
      for (const { projectId, repository } of await dependencies.registeredRepositories.list()) {
        watchRepository(projectId, repository);
      }
      await requestPoll();
    },
    stop: () => {
      stopped = true;
      clearTimeout(nextPollTimer);
      unsubscribe?.();
    },
    openTickets: (projectId) => watchesByProjectId.get(projectId)?.snapshot?.openTickets ?? [],
    ticket: ticketReads.ticket,
  };
}
