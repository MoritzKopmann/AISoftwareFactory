import type { Clock } from '../../../../shared/clock/clock.js';
import { buildNeedsYouRows } from '../domain/functions/build-needs-you-rows.js';
import { buildProjectBoard } from '../domain/functions/build-project-board.js';
import { failWatch } from '../domain/functions/fail-watch.js';
import { findRateLimitGate } from '../domain/functions/find-rate-limit-gate.js';
import { presentWatch } from '../domain/functions/present-watch.js';
import type { NeedsYouRow } from '../domain/types/needs-you-row.js';
import type { ProjectBoard } from '../domain/types/project-board.js';
import type { ProjectTicket } from '../domain/types/project-ticket.js';
import type { RepositoryWatch } from '../domain/types/repository-watch.js';
import type { SyncFailureCause } from '../domain/types/sync-status.js';
import type { Ticket } from '../domain/types/ticket.js';
import { GitHubAuthError } from '../errors/github-auth-error.js';
import { GitHubRateLimitedError } from '../errors/github-rate-limited-error.js';
import { GitHubRequestError } from '../errors/github-request-error.js';
import type { TicketSource } from '../port/github/ticket-source.js';
import type { RunPort } from '../port/run/run-port.js';
import type { WatchStore } from '../port/repository/watch-store.js';

export type TicketReadServiceDependencies = {
  readonly ticketSource: TicketSource;
  readonly runPort: Pick<RunPort, 'activeRunTicketNumbers' | 'waitsOf'>;
  readonly clock: Clock;
  readonly watchStore: WatchStore;
};

export class TicketReadService {
  constructor(private readonly dependencies: TicketReadServiceDependencies) {}

  async readTicket(projectId: string, number: number): Promise<ProjectTicket | undefined> {
    const { ticketSource, clock, watchStore } = this.dependencies;
    const storedWatch = watchStore.watch(projectId);
    if (storedWatch === undefined) {
      return undefined;
    }
    const watch = presentWatch(storedWatch, watchStore.statusWrites(projectId));
    const snapshotCopy = [
      ...(watch.snapshot?.openTickets ?? []),
      ...(watch.snapshot?.recentlyClosedTickets ?? []),
    ].find((ticket) => ticket.number === number);
    if (
      (snapshotCopy !== undefined && snapshotCopy.status !== 'closed') ||
      findRateLimitGate([watch], clock.now()) !== undefined
    ) {
      return this.serve(watch, snapshotCopy);
    }

    try {
      const ticket = await ticketSource.ticket(watch.repository, number);
      return ticket === undefined ? undefined : this.serve(watch, ticket);
    } catch (error) {
      if (error instanceof GitHubRateLimitedError) {
        return this.serveFailure(watch, snapshotCopy, 'rate-limited', error.message, error.retryAt);
      }
      if (error instanceof GitHubAuthError) {
        return this.serveFailure(watch, snapshotCopy, 'auth', error.message);
      }
      if (error instanceof GitHubRequestError) {
        return this.serveFailure(watch, snapshotCopy, 'unavailable', error.message);
      }
      throw error;
    }
  }

  async readProjectBoard(projectId: string): Promise<ProjectBoard | undefined> {
    const { runPort, watchStore } = this.dependencies;
    const watch = watchStore.watch(projectId);
    if (watch === undefined) {
      return undefined;
    }
    const runningTicketNumbers = await runPort.activeRunTicketNumbers(projectId);
    return {
      ...buildProjectBoard(presentWatch(watch, watchStore.statusWrites(projectId))),
      runningTicketNumbers,
    };
  }

  readOpenTickets(projectId: string): ReadonlyArray<Ticket> {
    const { watchStore } = this.dependencies;
    const watch = watchStore.watch(projectId);
    return watch === undefined
      ? []
      : (presentWatch(watch, watchStore.statusWrites(projectId)).snapshot?.openTickets ?? []);
  }

  async readNeedsYou(projectId: string): Promise<ReadonlyArray<NeedsYouRow> | undefined> {
    const { runPort, watchStore } = this.dependencies;
    const watch = watchStore.watch(projectId);
    if (watch === undefined) {
      return undefined;
    }
    const openTickets =
      presentWatch(watch, watchStore.statusWrites(projectId)).snapshot?.openTickets ?? [];
    return buildNeedsYouRows(openTickets, await runPort.waitsOf(projectId));
  }

  private serve(watch: RepositoryWatch, ticket?: Ticket): ProjectTicket {
    return {
      projectId: watch.projectId,
      sync: watch.sync,
      ...(ticket === undefined ? {} : { ticket }),
    };
  }

  private serveFailure(
    watch: RepositoryWatch,
    snapshotCopy: Ticket | undefined,
    cause: SyncFailureCause,
    message: string,
    retryAt?: Date,
  ): ProjectTicket {
    const failedWatch = failWatch(watch, {
      cause,
      message,
      failedAt: this.dependencies.clock.now(),
      ...(retryAt === undefined ? {} : { retryAt: retryAt.toISOString() }),
    });
    return this.serve(failedWatch, snapshotCopy);
  }
}
