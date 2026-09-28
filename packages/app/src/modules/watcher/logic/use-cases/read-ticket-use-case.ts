import type { Clock } from '../../../../shared/clock/clock.js';
import { failWatch } from '../domain/functions/fail-watch.js';
import { findRateLimitGate } from '../domain/functions/find-rate-limit-gate.js';
import type { ProjectTicket } from '../domain/types/project-ticket.js';
import type { RepositoryWatch } from '../domain/types/repository-watch.js';
import type { SyncFailureCause } from '../domain/types/sync-status.js';
import type { Ticket } from '../domain/types/ticket.js';
import { GitHubAuthError } from '../errors/github-auth-error.js';
import { GitHubRateLimitedError } from '../errors/github-rate-limited-error.js';
import { GitHubRequestError } from '../errors/github-request-error.js';
import type { TicketSource } from '../ports/ticket-source.js';

export type ReadTicketDependencies = {
  readonly ticketSource: TicketSource;
  readonly clock: Clock;
};

export class ReadTicketUseCase {
  constructor(private readonly dependencies: ReadTicketDependencies) {}

  async execute(watch: RepositoryWatch, number: number): Promise<ProjectTicket | undefined> {
    const { ticketSource, clock } = this.dependencies;
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
