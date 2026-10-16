import type { Clock } from '../../../../shared/clock/clock.js';
import type { EventPublisher } from '../../../../shared/event-bus.js';
import { diffSnapshots } from '../domain/functions/diff-snapshots.js';
import { failWatch } from '../domain/functions/fail-watch.js';
import { findRateLimitGate } from '../domain/functions/find-rate-limit-gate.js';
import { hasSnapshotChanges } from '../domain/functions/has-snapshot-changes.js';
import { hasWatchChanged } from '../domain/functions/has-watch-changed.js';
import { pruneStatusWrites } from '../domain/functions/prune-status-writes.js';
import { shouldTakeSnapshot } from '../domain/functions/should-take-snapshot.js';
import type { RateLimitGate } from '../domain/types/rate-limit-gate.js';
import type { RepositoryReference } from '../domain/types/repository-reference.js';
import type { RepositoryWatch } from '../domain/types/repository-watch.js';
import type { StatusWrite } from '../domain/types/status-write.js';
import type { SyncFailureCause } from '../domain/types/sync-status.js';
import { GitHubAuthError } from '../errors/github-auth-error.js';
import { GitHubRateLimitedError } from '../errors/github-rate-limited-error.js';
import { GitHubRequestError } from '../errors/github-request-error.js';
import type { IssueFeeds } from '../port/github/issue-feeds.js';
import type { TicketSource } from '../port/github/ticket-source.js';
import type { ProjectPort } from '../port/project/project-port.js';
import type { WatchStore } from '../port/repository/watch-store.js';

export type RepositoryWatchServiceDependencies = {
  readonly issueFeeds: IssueFeeds;
  readonly ticketSource: TicketSource;
  readonly projectPort: ProjectPort;
  readonly clock: Clock;
  readonly events: EventPublisher;
  readonly watchStore: WatchStore;
  readonly pollIntervalMilliseconds: number;
  readonly snapshotIntervalMilliseconds: number;
};

export class RepositoryWatchService {
  private nextPollTimer: ReturnType<typeof setTimeout> | undefined;
  private runningPolls: Promise<void> | undefined;
  private pollRequested = false;
  private readonly forcedRepositories: RepositoryReference[] = [];
  private stopped = false;

  constructor(private readonly dependencies: RepositoryWatchServiceDependencies) {}

  /** Watches every registered repository and polls once. Later polls follow on a timer. */
  async startWatching(): Promise<void> {
    this.stopped = false;
    for (const { projectId, repository } of await this.dependencies.projectPort.list()) {
      this.watch(projectId, repository);
    }
    await this.requestPoll();
  }

  stopWatching(): void {
    this.stopped = true;
    clearTimeout(this.nextPollTimer);
  }

  watch(projectId: string, repository: RepositoryReference): void {
    const { watchStore } = this.dependencies;
    if (watchStore.watch(projectId) === undefined) {
      watchStore.saveWatch({ projectId, repository, sync: { state: 'pending' } });
    }
  }

  async watchAndPoll(projectId: string, repository: RepositoryReference): Promise<void> {
    this.watch(projectId, repository);
    await this.requestPoll();
  }

  recordStatusWrite(projectId: string, write: Omit<StatusWrite, 'writtenAt'>): void {
    const { watchStore, clock } = this.dependencies;
    watchStore.saveStatusWrite(projectId, { ...write, writtenAt: clock.now() });
  }

  async recordStatusWriteAndPoll(
    projectId: string,
    write: Omit<StatusWrite, 'writtenAt'>,
  ): Promise<void> {
    this.recordStatusWrite(projectId, write);
    await this.requestPoll();
  }

  /** Joins the poll loop, so a snapshot never overlaps the timer poll. */
  refresh(repository: RepositoryReference): Promise<void> {
    this.forcedRepositories.push(repository);
    return this.requestPoll();
  }

  requestPoll(): Promise<void> {
    if (this.runningPolls !== undefined) {
      this.pollRequested = true;
      return this.runningPolls;
    }
    clearTimeout(this.nextPollTimer);
    this.runningPolls = (async () => {
      do {
        this.pollRequested = false;
        await this.runPoll();
      } while (this.pollRequested && !this.stopped);
      this.runningPolls = undefined;
      this.scheduleNextPoll();
    })();
    return this.runningPolls;
  }

  // A forced repository takes a snapshot even when its feeds report no change.
  async poll(forced: ReadonlyArray<RepositoryReference> = []): Promise<void> {
    const { watchStore, clock, events } = this.dependencies;
    const previousWatches = watchStore.watches();
    for (const watch of await this.pollAll(previousWatches, forced)) {
      const previous = previousWatches.find(({ projectId }) => projectId === watch.projectId);
      const writesBefore = watchStore.statusWrites(watch.projectId).length;
      watchStore.saveWatch(watch);
      if (watch.snapshot !== undefined) {
        watchStore.replaceStatusWrites(
          watch.projectId,
          pruneStatusWrites(watchStore.statusWrites(watch.projectId), watch.snapshot, clock.now()),
        );
      }
      const pruned = watchStore.statusWrites(watch.projectId).length < writesBefore;
      events.emit('watch.updated', {
        projectId: watch.projectId,
        changed: pruned || previous === undefined || hasWatchChanged(previous, watch),
        polledAt: clock.now(),
      });
    }
  }

  failWatches(error: unknown): void {
    const { watchStore, clock, events } = this.dependencies;
    const failedAt = clock.now();
    const message = error instanceof Error ? error.message : String(error);
    for (const watch of watchStore.watches()) {
      const failedWatch = failWatch(watch, { cause: 'unexpected', message, failedAt });
      watchStore.saveWatch(failedWatch);
      events.emit('watch.updated', {
        projectId: watch.projectId,
        changed: hasWatchChanged(watch, failedWatch),
        polledAt: clock.now(),
      });
    }
  }

  // The timer callback must never reject, or an unhandled rejection ends the process.
  private async runPoll(): Promise<void> {
    try {
      await this.poll(this.forcedRepositories.splice(0));
    } catch (error) {
      this.failWatches(error);
    }
  }

  private scheduleNextPoll(): void {
    if (this.stopped) {
      return;
    }
    this.nextPollTimer = setTimeout(() => {
      void this.requestPoll();
    }, this.dependencies.pollIntervalMilliseconds);
    this.nextPollTimer.unref();
  }

  private async pollAll(
    watches: ReadonlyArray<RepositoryWatch>,
    forced: ReadonlyArray<RepositoryReference>,
  ): Promise<ReadonlyArray<RepositoryWatch>> {
    const gate = findRateLimitGate(watches, this.dependencies.clock.now());
    if (gate !== undefined) {
      return watches.map((watch) => this.pauseForRateLimit(watch, gate));
    }

    const polledWatches: RepositoryWatch[] = [];
    for (const [index, watch] of watches.entries()) {
      try {
        polledWatches.push(
          await this.pollRepository(
            watch,
            this.dependencies.watchStore.statusWrites(watch.projectId).length > 0,
            forced.some(
              ({ owner, name }) =>
                owner === watch.repository.owner && name === watch.repository.name,
            ),
          ),
        );
      } catch (error) {
        if (error instanceof GitHubRateLimitedError) {
          const newGate = { retryAt: error.retryAt.toISOString(), message: error.message };
          return [...polledWatches, ...watches.slice(index)].map((pausedWatch) =>
            this.pauseForRateLimit(pausedWatch, newGate),
          );
        }
        // Never-crash boundary per repository: an unknown error must not discard the
        // repositories already polled so far or block the ones after it.
        polledWatches.push(this.failWatch(watch, this.describeFailure(error)));
      }
    }
    return polledWatches;
  }

  private async pollRepository(
    watch: RepositoryWatch,
    hasUnconfirmedStatusWrites: boolean,
    isForced: boolean,
  ): Promise<RepositoryWatch> {
    const { issueFeeds, ticketSource, clock, events, snapshotIntervalMilliseconds } =
      this.dependencies;
    const feedsChanged = isForced || (await issueFeeds.changedSince(watch.repository));
    const checkedAt = clock.now();
    const takeSnapshot = shouldTakeSnapshot({
      feedsChanged,
      watch,
      now: checkedAt,
      snapshotIntervalMilliseconds,
      hasUnconfirmedStatusWrites,
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
