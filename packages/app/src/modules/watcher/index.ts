import type { EventSubscriber } from '../../shared/bus/event-subscriber.js';
import { subscribeToProjectAdded } from './api/subscriptions/subscribe-to-project-added.js';
import { buildProjectBoard } from './logic/domain/functions/build-project-board.js';
import { failWatch } from './logic/domain/functions/fail-watch.js';
import type { ProjectBoard } from './logic/domain/types/project-board.js';
import type { ProjectTicket } from './logic/domain/types/project-ticket.js';
import type { RepositoryReference } from './logic/domain/types/repository-reference.js';
import type { RepositoryWatch } from './logic/domain/types/repository-watch.js';
import type { Ticket } from './logic/domain/types/ticket.js';
import type { RegisteredRepositories } from './logic/ports/registered-repositories.js';
import {
  PollRepositoriesUseCase,
  type PollRepositoriesDependencies,
} from './logic/use-cases/poll-repositories-use-case.js';
import { ReadTicketUseCase } from './logic/use-cases/read-ticket-use-case.js';

export type { BoardRow } from './logic/domain/types/board-row.js';
export type { BoardView } from './logic/domain/types/board-view.js';
export type { ProjectBoard } from './logic/domain/types/project-board.js';
export type { ProjectTicket } from './logic/domain/types/project-ticket.js';
export type { SnapshotDiff } from './logic/domain/types/snapshot-diff.js';
export type { SyncFailureCause, SyncStatus } from './logic/domain/types/sync-status.js';
export type { Ticket } from './logic/domain/types/ticket.js';
export type { TicketSnapshot } from './logic/domain/types/ticket-snapshot.js';
export type {
  RegisteredRepositories,
  RegisteredRepository,
} from './logic/ports/registered-repositories.js';

export type WatcherModuleDependencies = PollRepositoriesDependencies & {
  readonly subscriber: EventSubscriber;
  readonly registeredRepositories: RegisteredRepositories;
  readonly pollIntervalMilliseconds: number;
};

export type WatcherModule = {
  readonly start: () => Promise<void>;
  readonly stop: () => void;
  readonly board: (projectId: string) => ProjectBoard | undefined;
  readonly openTickets: (projectId: string) => ReadonlyArray<Ticket>;
  readonly ticket: (projectId: string, number: number) => Promise<ProjectTicket | undefined>;
};

export function createWatcherModule(dependencies: WatcherModuleDependencies): WatcherModule {
  const pollRepositories = new PollRepositoriesUseCase(dependencies);
  const readTicket = new ReadTicketUseCase(dependencies);
  const watchesByProjectId = new Map<string, RepositoryWatch>();
  let nextPassTimer: ReturnType<typeof setTimeout> | undefined;
  let unsubscribe: (() => void) | undefined;
  let currentPasses: Promise<void> | undefined;
  let passRequested = false;
  let stopped = false;

  function watchRepository(projectId: string, repository: RepositoryReference): void {
    if (!watchesByProjectId.has(projectId)) {
      watchesByProjectId.set(projectId, { projectId, repository, sync: { state: 'pending' } });
    }
  }

  // The timer callback must never reject, or an unhandled rejection ends the process.
  async function runPass(): Promise<void> {
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

  function scheduleNextPass(): void {
    if (stopped) {
      return;
    }
    nextPassTimer = setTimeout(() => {
      void requestPass();
    }, dependencies.pollIntervalMilliseconds);
    nextPassTimer.unref();
  }

  function requestPass(): Promise<void> {
    if (currentPasses !== undefined) {
      passRequested = true;
      return currentPasses;
    }
    clearTimeout(nextPassTimer);
    currentPasses = (async () => {
      do {
        passRequested = false;
        await runPass();
      } while (passRequested && !stopped);
      currentPasses = undefined;
      scheduleNextPass();
    })();
    return currentPasses;
  }

  return {
    start: async () => {
      stopped = false;
      unsubscribe = subscribeToProjectAdded(dependencies.subscriber, (projectId, repository) => {
        watchRepository(projectId, repository);
        void requestPass();
      });
      for (const { projectId, repository } of await dependencies.registeredRepositories.list()) {
        watchRepository(projectId, repository);
      }
      await requestPass();
    },
    stop: () => {
      stopped = true;
      clearTimeout(nextPassTimer);
      unsubscribe?.();
    },
    board: (projectId) => {
      const watch = watchesByProjectId.get(projectId);
      return watch === undefined ? undefined : buildProjectBoard(watch);
    },
    openTickets: (projectId) => watchesByProjectId.get(projectId)?.snapshot?.openTickets ?? [],
    ticket: async (projectId, number) => {
      const watch = watchesByProjectId.get(projectId);
      return watch === undefined ? undefined : readTicket.execute(watch, number);
    },
  };
}
