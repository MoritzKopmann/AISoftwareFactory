import type { EventPublisher } from '../../../../shared/bus/event-publisher.js';
import type { Clock } from '../../../../shared/clock/clock.js';
import { diffSnapshots } from '../domain/functions/diff-snapshots.js';
import { failWatch } from '../domain/functions/fail-watch.js';
import { findRateLimitGate } from '../domain/functions/find-rate-limit-gate.js';
import { hasSnapshotChanges } from '../domain/functions/has-snapshot-changes.js';
import { shouldTakeSnapshot } from '../domain/functions/should-take-snapshot.js';
import type { RateLimitGate } from '../domain/types/rate-limit-gate.js';
import type { RepositoryWatch } from '../domain/types/repository-watch.js';
import type { SyncFailureCause } from '../domain/types/sync-status.js';
import { GitHubAuthError } from '../errors/github-auth-error.js';
import { GitHubRateLimitedError } from '../errors/github-rate-limited-error.js';
import { GitHubRequestError } from '../errors/github-request-error.js';
import type { IssueFeeds } from '../ports/issue-feeds.js';
import type { TicketSource } from '../ports/ticket-source.js';

export type PollRepositoriesDependencies = {
  readonly issueFeeds: IssueFeeds;
  readonly ticketSource: TicketSource;
  readonly clock: Clock;
  readonly events: EventPublisher;
  readonly snapshotIntervalMilliseconds: number;
};

export class PollRepositoriesUseCase {
  constructor(private readonly dependencies: PollRepositoriesDependencies) {}

  async execute(watches: ReadonlyArray<RepositoryWatch>): Promise<ReadonlyArray<RepositoryWatch>> {
    const gate = findRateLimitGate(watches, this.dependencies.clock.now());
    if (gate !== undefined) {
      return watches.map((watch) => this.pauseForRateLimit(watch, gate));
    }

    const polledWatches: RepositoryWatch[] = [];
    for (const [index, watch] of watches.entries()) {
      try {
        polledWatches.push(await this.pollRepository(watch));
      } catch (error) {
        if (error instanceof GitHubRateLimitedError) {
          const newGate = { retryAt: error.retryAt.toISOString(), message: error.message };
          return [...polledWatches, ...watches.slice(index)].map((pausedWatch) =>
            this.pauseForRateLimit(pausedWatch, newGate),
          );
        }
        // Never-crash boundary per repository: an unknown error must not discard the
        // repositories already polled in this pass or block the ones after it.
        polledWatches.push(this.failWatch(watch, this.describeFailure(error)));
      }
    }
    return polledWatches;
  }

  private async pollRepository(watch: RepositoryWatch): Promise<RepositoryWatch> {
    const { issueFeeds, ticketSource, clock, events, snapshotIntervalMilliseconds } =
      this.dependencies;
    const feedsChanged = await issueFeeds.changedSince(watch.repository);
    const checkedAt = clock.now();
    const takeSnapshot = shouldTakeSnapshot({
      feedsChanged,
      watch,
      now: checkedAt,
      snapshotIntervalMilliseconds,
    });
    if (!takeSnapshot && watch.snapshot !== undefined) {
      return {
        ...watch,
        sync: { state: 'ok', checkedAt, snapshotTakenAt: watch.snapshot.takenAt },
      };
    }

    const snapshot = await ticketSource.snapshot(watch.repository);
    const diff = diffSnapshots(watch.snapshot, snapshot);
    if (hasSnapshotChanges(diff)) {
      events.emit('snapshot.changed', { projectId: watch.projectId, ...diff });
    }
    return {
      ...watch,
      snapshot,
      sync: { state: 'ok', checkedAt: clock.now(), snapshotTakenAt: snapshot.takenAt },
    };
  }

  private describeFailure(error: unknown): {
    readonly cause: SyncFailureCause;
    readonly message: string;
  } {
    if (error instanceof GitHubAuthError) {
      return { cause: 'auth', message: error.message };
    }
    if (error instanceof GitHubRequestError) {
      return { cause: 'unavailable', message: error.message };
    }
    return { cause: 'unexpected', message: error instanceof Error ? error.message : String(error) };
  }

  private pauseForRateLimit(watch: RepositoryWatch, gate: RateLimitGate): RepositoryWatch {
    return this.failWatch(watch, { cause: 'rate-limited', message: gate.message }, gate.retryAt);
  }

  private failWatch(
    watch: RepositoryWatch,
    failure: { readonly cause: SyncFailureCause; readonly message: string },
    retryAt?: string,
  ): RepositoryWatch {
    return failWatch(watch, {
      ...failure,
      failedAt: this.dependencies.clock.now(),
      ...(retryAt === undefined ? {} : { retryAt }),
    });
  }
}
