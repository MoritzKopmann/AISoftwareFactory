import { describe, expect, it } from 'vitest';
import type { RepositoryWatch } from '../../../../../src/modules/watcher/logic/domain/types/repository-watch.js';
import type { TicketSnapshot } from '../../../../../src/modules/watcher/logic/domain/types/ticket-snapshot.js';
import { GitHubAuthError } from '../../../../../src/modules/watcher/logic/errors/github-auth-error.js';
import { GitHubRateLimitedError } from '../../../../../src/modules/watcher/logic/errors/github-rate-limited-error.js';
import { GitHubRequestError } from '../../../../../src/modules/watcher/logic/errors/github-request-error.js';
import { InMemoryWatchStore } from '../../../../../src/modules/watcher/infra/integrations/in-memory-watch-store.js';
import { PollRepositoriesUseCase } from '../../../../../src/modules/watcher/logic/use-cases/poll-repositories-use-case.js';
import { FakeClock } from '../../../../fakes/fake-clock.js';
import { FakeEventPublisher } from '../../../../fakes/fake-event-publisher.js';
import { buildTicket } from '../../fakes/build-ticket.js';
import { FakeIssueFeeds, FakeTicketSource } from '../../fakes/fake-watcher-ports.js';

const startedAt = '2026-09-28T12:00:00.000Z';
const snapshotIntervalMilliseconds = 300_000;

function buildSnapshot(
  takenAt: string,
  tickets: ReadonlyArray<ReturnType<typeof buildTicket>>,
): TicketSnapshot {
  return { takenAt, openTickets: tickets, recentlyClosedTickets: [], closedTotalCount: 0 };
}

function buildWatch(projectId: string, overrides: Partial<RepositoryWatch> = {}): RepositoryWatch {
  const [owner = '', name = ''] = projectId.split('/');
  return { projectId, repository: { owner, name }, sync: { state: 'pending' }, ...overrides };
}

function createSubject() {
  const issueFeeds = new FakeIssueFeeds();
  const ticketSource = new FakeTicketSource(buildSnapshot(startedAt, [buildTicket({ number: 1 })]));
  const clock = new FakeClock(startedAt);
  const events = new FakeEventPublisher();
  const watchStore = new InMemoryWatchStore();
  const pollRepositories = new PollRepositoriesUseCase({
    issueFeeds,
    ticketSource,
    clock,
    events,
    watchStore,
    snapshotIntervalMilliseconds,
  });
  const useCase = {
    // Seeds the store with the given watches, polls, and returns the stored result.
    execute: async (
      watches: ReadonlyArray<RepositoryWatch>,
      projectIdsWithStatusWrites: ReadonlySet<string> = new Set(),
    ): Promise<ReadonlyArray<RepositoryWatch>> => {
      for (const watch of watches) {
        watchStore.saveWatch(watch);
      }
      for (const projectId of projectIdsWithStatusWrites) {
        watchStore.saveStatusWrite(projectId, {
          ticketNumber: 0,
          from: 'ready',
          to: 'ready',
          writtenAt: startedAt,
        });
      }
      await pollRepositories.execute();
      return watches.map(({ projectId }) => watchStore.watch(projectId) as RepositoryWatch);
    },
  };
  const snapshotEvents = {
    get emittedEvents() {
      return events.emittedEvents.filter((event) => event.name !== 'watch.updated');
    },
  };
  return {
    useCase,
    pollRepositories,
    watchStore,
    issueFeeds,
    ticketSource,
    clock,
    events: snapshotEvents,
    allEvents: events,
  };
}

describe('PollRepositoriesUseCase', () => {
  describe('execute', () => {
    it('should snapshot and announce every ticket as added when the repository has no snapshot', async () => {
      const { useCase, ticketSource, events } = createSubject();
      ticketSource.snapshotToReturn = buildSnapshot(startedAt, [
        buildTicket({ number: 1 }),
        buildTicket({ number: 2 }),
      ]);

      const [watch] = await useCase.execute([buildWatch('owner/name')]);

      expect(watch?.sync).toEqual({
        state: 'ok',
        checkedAt: startedAt,
        snapshotTakenAt: startedAt,
      });
      expect(watch?.snapshot?.openTickets).toHaveLength(2);
      expect(events.emittedEvents).toEqual([
        {
          name: 'snapshot.changed',
          payload: {
            projectId: 'owner/name',
            addedTicketNumbers: [1, 2],
            changedTicketNumbers: [],
            removedTicketNumbers: [],
          },
        },
      ]);
    });

    it('should check the feeds only and keep the snapshot when nothing changed', async () => {
      const { useCase, issueFeeds, ticketSource, clock, events } = createSubject();
      const [firstWatch] = await useCase.execute([buildWatch('owner/name')]);
      clock.setNow('2026-09-28T12:00:30.000Z');

      const [secondWatch] = await useCase.execute([firstWatch as RepositoryWatch]);

      expect(issueFeeds.requests).toHaveLength(2);
      expect(ticketSource.snapshotRequests).toHaveLength(1);
      expect(events.emittedEvents).toHaveLength(1);
      expect(secondWatch?.sync).toEqual({
        state: 'ok',
        checkedAt: '2026-09-28T12:00:30.000Z',
        snapshotTakenAt: startedAt,
      });
    });

    it('should announce the ticket as changed when a feed changed and its labels differ', async () => {
      const { useCase, issueFeeds, ticketSource, clock, events } = createSubject();
      const [firstWatch] = await useCase.execute([buildWatch('owner/name')]);
      clock.setNow('2026-09-28T12:00:30.000Z');
      issueFeeds.changed = true;
      ticketSource.snapshotToReturn = buildSnapshot('2026-09-28T12:00:30.000Z', [
        buildTicket({ number: 1, status: 'ready' }),
      ]);

      const [secondWatch] = await useCase.execute([firstWatch as RepositoryWatch]);

      expect(events.emittedEvents.at(-1)?.payload).toEqual({
        projectId: 'owner/name',
        addedTicketNumbers: [],
        changedTicketNumbers: [1],
        removedTicketNumbers: [],
      });
      expect(secondWatch?.snapshot?.openTickets[0]?.status).toBe('ready');
    });

    it('should not announce anything when a snapshot is identical to the last', async () => {
      const { useCase, ticketSource, clock, events } = createSubject();
      const [firstWatch] = await useCase.execute([buildWatch('owner/name')]);
      clock.setNow('2026-09-28T12:06:00.000Z');

      await useCase.execute([firstWatch as RepositoryWatch]);

      expect(ticketSource.snapshotRequests).toHaveLength(2);
      expect(events.emittedEvents).toHaveLength(1);
    });

    it('should snapshot again on the next poll when a snapshot failed after a feed changed', async () => {
      const { useCase, issueFeeds, ticketSource, clock } = createSubject();
      issueFeeds.changed = true;
      ticketSource.failure = new GitHubRequestError('GitHub answered 502');
      const [failedWatch] = await useCase.execute([buildWatch('owner/name')]);
      issueFeeds.changed = false;
      ticketSource.failure = undefined;
      clock.setNow('2026-09-28T12:00:30.000Z');

      const [recoveredWatch] = await useCase.execute([failedWatch as RepositoryWatch]);

      expect(failedWatch?.sync).toEqual({
        state: 'failed',
        cause: 'unavailable',
        message: 'GitHub answered 502',
        failedAt: startedAt,
      });
      expect(ticketSource.snapshotRequests).toHaveLength(2);
      expect(recoveredWatch?.sync.state).toBe('ok');
    });

    it('should keep polling the other repositories when one fails with a request error', async () => {
      const { useCase, ticketSource } = createSubject();
      ticketSource.failuresByRepositoryName.set('first', new GitHubRequestError('gone'));

      const [firstWatch, secondWatch] = await useCase.execute([
        buildWatch('owner/first'),
        buildWatch('owner/second'),
      ]);

      expect(firstWatch?.sync.state).toBe('failed');
      expect(secondWatch?.sync.state).toBe('ok');
    });

    it('should keep the polled repositories and continue when one fails with an unknown error', async () => {
      const { useCase, ticketSource, events } = createSubject();
      ticketSource.failuresByRepositoryName.set('second', new TypeError('malformed answer'));

      const watches = await useCase.execute([
        buildWatch('owner/first'),
        buildWatch('owner/second'),
        buildWatch('owner/third'),
      ]);

      expect(watches.map((watch) => watch.sync.state)).toEqual(['ok', 'failed', 'ok']);
      expect(watches[1]?.sync).toMatchObject({
        cause: 'unexpected',
        message: 'malformed answer',
      });
      expect(watches[0]?.snapshot).toBeDefined();
      expect(events.emittedEvents.map((event) => event.name)).toEqual([
        'snapshot.changed',
        'snapshot.changed',
      ]);
    });

    it('should report the auth failure and keep the last good snapshot when the token is rejected', async () => {
      const { useCase, issueFeeds, ticketSource, clock } = createSubject();
      const [goodWatch] = await useCase.execute([buildWatch('owner/name')]);
      issueFeeds.failure = new GitHubAuthError('GitHub rejected the gh token: run gh auth login');
      clock.setNow('2026-09-28T12:00:30.000Z');

      const [failedWatch] = await useCase.execute([goodWatch as RepositoryWatch]);

      expect(failedWatch?.sync).toEqual({
        state: 'failed',
        cause: 'auth',
        message: 'GitHub rejected the gh token: run gh auth login',
        failedAt: '2026-09-28T12:00:30.000Z',
        snapshotTakenAt: startedAt,
      });
      expect(failedWatch?.snapshot).toBe(goodWatch?.snapshot);
      expect(ticketSource.snapshotRequests).toHaveLength(1);
    });

    describe('when GitHub rate-limits a request', () => {
      const retryAt = new Date('2026-09-28T12:10:00.000Z');

      async function rateLimit() {
        const subject = createSubject();
        subject.issueFeeds.failure = new GitHubRateLimitedError('rate limit reached', retryAt);
        const watches = await subject.useCase.execute([
          buildWatch('owner/first'),
          buildWatch('owner/second'),
        ]);
        return { ...subject, watches };
      }

      it('should show every repository as rate-limited with the retry time', async () => {
        const { watches, issueFeeds } = await rateLimit();

        expect(watches.map((watch) => watch.sync)).toEqual([
          expect.objectContaining({
            state: 'failed',
            cause: 'rate-limited',
            retryAt: retryAt.toISOString(),
          }),
          expect.objectContaining({
            state: 'failed',
            cause: 'rate-limited',
            retryAt: retryAt.toISOString(),
          }),
        ]);
        expect(issueFeeds.requests).toHaveLength(1);
      });

      it('should make no GitHub call before the retry time', async () => {
        const { useCase, watches, issueFeeds, clock } = await rateLimit();
        clock.setNow('2026-09-28T12:05:00.000Z');

        const gatedWatches = await useCase.execute(watches);

        expect(issueFeeds.requests).toHaveLength(1);
        expect(gatedWatches[0]?.sync).toMatchObject({
          state: 'failed',
          cause: 'rate-limited',
          retryAt: retryAt.toISOString(),
        });
      });

      it('should snapshot on the first poll after the retry time', async () => {
        const { useCase, watches, issueFeeds, ticketSource, clock } = await rateLimit();
        issueFeeds.failure = undefined;
        clock.setNow('2026-09-28T12:10:00.000Z');

        const resumedWatches = await useCase.execute(watches);

        expect(ticketSource.snapshotRequests).toHaveLength(2);
        expect(resumedWatches.map((watch) => watch.sync.state)).toEqual(['ok', 'ok']);
      });
    });
  });

  describe('watch.updated', () => {
    type Seen = {
      readonly projectId: string;
      readonly watch: RepositoryWatch | undefined;
      readonly writeCount: number;
    };

    function createObservedSubject() {
      const issueFeeds = new FakeIssueFeeds();
      const ticketSource = new FakeTicketSource(
        buildSnapshot(startedAt, [buildTicket({ number: 1 })]),
      );
      const clock = new FakeClock(startedAt);
      const watchStore = new InMemoryWatchStore();
      const seen: Seen[] = [];
      const events = {
        emit: (name: string, payload: { projectId?: string }) => {
          if (name === 'watch.updated' && payload.projectId !== undefined) {
            seen.push({
              projectId: payload.projectId,
              watch: watchStore.watch(payload.projectId),
              writeCount: watchStore.statusWrites(payload.projectId).length,
            });
          }
        },
      };
      const useCase = new PollRepositoriesUseCase({
        issueFeeds,
        ticketSource,
        clock,
        events,
        watchStore,
        snapshotIntervalMilliseconds,
      });
      return { useCase, issueFeeds, ticketSource, clock, watchStore, seen };
    }

    it('should announce a watch after its poll is stored when the feeds are unchanged', async () => {
      const { useCase, watchStore, clock, seen } = createObservedSubject();
      watchStore.saveWatch(buildWatch('octo/repo'));
      await useCase.execute();
      clock.setNow('2026-09-28T12:00:30.000Z');
      seen.length = 0;

      await useCase.execute();

      expect(seen).toHaveLength(1);
      expect(seen[0]?.projectId).toBe('octo/repo');
      expect(seen[0]?.watch?.sync).toMatchObject({
        state: 'ok',
        checkedAt: '2026-09-28T12:00:30.000Z',
      });
    });

    it('should show each project its own poll when several projects are polled', async () => {
      const { useCase, watchStore, seen } = createObservedSubject();
      watchStore.saveWatch(buildWatch('octo/one'));
      watchStore.saveWatch(buildWatch('octo/two'));

      await useCase.execute();

      expect(seen.map((entry) => entry.projectId)).toEqual(['octo/one', 'octo/two']);
      expect(seen[0]?.watch?.snapshot?.openTickets.map((ticket) => ticket.number)).toEqual([1]);
      expect(seen[0]?.watch?.sync.state).toBe('ok');
    });

    it('should announce a failed watch when GitHub answers with a rate limit', async () => {
      const { useCase, watchStore, ticketSource, seen } = createObservedSubject();
      ticketSource.failure = new GitHubRateLimitedError(
        'limited',
        new Date('2026-09-28T13:00:00.000Z'),
      );
      watchStore.saveWatch(buildWatch('octo/repo'));

      await useCase.execute();

      expect(seen).toHaveLength(1);
      expect(seen[0]?.watch?.sync).toMatchObject({ state: 'failed', cause: 'rate-limited' });
    });

    it('should announce after an expired status write is pruned when the write is unconfirmed', async () => {
      const { useCase, watchStore, clock, seen } = createObservedSubject();
      watchStore.saveWatch(buildWatch('octo/repo'));
      await useCase.execute();
      seen.length = 0;
      watchStore.saveStatusWrite('octo/repo', {
        ticketNumber: 1,
        from: 'stuck',
        to: 'ready',
        writtenAt: startedAt,
      });
      clock.setNow('2026-09-28T12:01:01.000Z');

      await useCase.execute();

      expect(seen).toHaveLength(1);
      expect(seen[0]?.writeCount).toBe(0);
    });
  });
});
