import { describe, expect, it } from 'vitest';
import type { RepositoryWatch } from '../domain/types/repository-watch.js';
import type { TicketSnapshot } from '../domain/types/ticket-snapshot.js';
import { GitHubAuthError } from '../errors/github-auth-error.js';
import { GitHubRateLimitedError } from '../errors/github-rate-limited-error.js';
import { GitHubRequestError } from '../errors/github-request-error.js';
import { InMemoryWatchStore } from '../../infrastructure/repository/in-memory-watch-store.js';
import { FakeClock } from '../../../../shared/testing/fake-clock.js';
import { FakeEventPublisher } from '../../../../shared/testing/fake-event-publisher.js';
import { buildTicket } from '../../testing/build-ticket.js';
import { FakeIssueFeeds, FakeTicketSource } from '../../testing/fake-tickets-ports.js';
import { RepositoryWatchService } from './repository-watch-service.js';
import { unusedRepositoryWatchDependencies } from '../../testing/unused-dependencies.js';

describe('RepositoryWatchService', () => {
  describe('poll', () => {
    const startedAt = '2026-09-28T12:00:00.000Z';
    const snapshotIntervalMilliseconds = 300_000;

    function buildSnapshot(
      takenAt: string,
      tickets: ReadonlyArray<ReturnType<typeof buildTicket>>,
    ): TicketSnapshot {
      return { takenAt, openTickets: tickets, recentlyClosedTickets: [], closedTotalCount: 0 };
    }

    function buildWatch(
      projectId: string,
      overrides: Partial<RepositoryWatch> = {},
    ): RepositoryWatch {
      const [owner = '', name = ''] = projectId.split('/');
      return { projectId, repository: { owner, name }, sync: { state: 'pending' }, ...overrides };
    }

    function createSubject() {
      const issueFeeds = new FakeIssueFeeds();
      const ticketSource = new FakeTicketSource(
        buildSnapshot(startedAt, [buildTicket({ number: 1 })]),
      );
      const clock = new FakeClock(startedAt);
      const events = new FakeEventPublisher();
      const watchStore = new InMemoryWatchStore();
      const repositoryWatchService = new RepositoryWatchService({
        ...unusedRepositoryWatchDependencies,
        issueFeeds,
        ticketSource,
        clock,
        events,
        watchStore,
        snapshotIntervalMilliseconds,
      });
      const watchPolling = {
        // Seeds the store with the given watches, polls, and returns the stored result.
        pollWatches: async (
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
              waiting: false,
              stuck: false,
              writtenAt: startedAt,
            });
          }
          await repositoryWatchService.poll();
          return watches.map(({ projectId }) => watchStore.watch(projectId) as RepositoryWatch);
        },
      };
      const snapshotEvents = {
        get emittedEvents() {
          return events.emittedEvents.filter((event) => event.name !== 'watch.updated');
        },
      };
      return {
        watchPolling,
        repositoryWatchService,
        watchStore,
        issueFeeds,
        ticketSource,
        clock,
        events: snapshotEvents,
        allEvents: events,
      };
    }

    describe('ticket.closed', () => {
      function closedEvents(emitted: ReadonlyArray<{ name: string; payload: unknown }>) {
        return emitted.filter(({ name }) => name === 'ticket.closed').map(({ payload }) => payload);
      }

      it('should emit ticket.closed once when a ticket closed between two polls', async () => {
        const { watchPolling, ticketSource, clock, allEvents } = createSubject();
        ticketSource.snapshotToReturn = buildSnapshot(startedAt, [
          buildTicket({ number: 7, status: 'ready' }),
        ]);
        const [firstWatch] = await watchPolling.pollWatches([buildWatch('owner/name')]);
        clock.setNow('2026-09-28T12:10:00.000Z');
        ticketSource.snapshotToReturn = buildSnapshot('2026-09-28T12:10:00.000Z', [
          buildTicket({ number: 7, status: 'closed' }),
        ]);

        await watchPolling.pollWatches([firstWatch as RepositoryWatch]);

        expect(closedEvents(allEvents.emittedEvents)).toEqual([
          { projectId: 'owner/name', ticketNumber: 7 },
        ]);
      });

      it('should emit ticket.closed for each closed ticket when there is no previous snapshot', async () => {
        const { watchPolling, ticketSource, allEvents } = createSubject();
        ticketSource.snapshotToReturn = buildSnapshot(startedAt, [
          buildTicket({ number: 3, status: 'closed' }),
          buildTicket({ number: 4, status: 'closed' }),
          buildTicket({ number: 5, status: 'ready' }),
        ]);

        await watchPolling.pollWatches([buildWatch('owner/name')]);

        expect(closedEvents(allEvents.emittedEvents)).toEqual([
          { projectId: 'owner/name', ticketNumber: 3 },
          { projectId: 'owner/name', ticketNumber: 4 },
        ]);
      });

      it('should not emit ticket.closed when the ticket was already closed', async () => {
        const { watchPolling, ticketSource, clock, allEvents } = createSubject();
        ticketSource.snapshotToReturn = buildSnapshot(startedAt, [
          buildTicket({ number: 7, status: 'closed' }),
        ]);
        const [firstWatch] = await watchPolling.pollWatches([buildWatch('owner/name')]);
        allEvents.emittedEvents.length = 0;
        clock.setNow('2026-09-28T12:10:00.000Z');
        ticketSource.snapshotToReturn = buildSnapshot('2026-09-28T12:10:00.000Z', [
          buildTicket({ number: 7, status: 'closed', title: 'Renamed' }),
        ]);

        await watchPolling.pollWatches([firstWatch as RepositoryWatch]);

        expect(closedEvents(allEvents.emittedEvents)).toEqual([]);
      });

      it('should emit ticket.closed after snapshot.changed when the snapshot has both', async () => {
        const { watchPolling, ticketSource, allEvents } = createSubject();
        ticketSource.snapshotToReturn = buildSnapshot(startedAt, [
          buildTicket({ number: 9, status: 'closed' }),
        ]);

        await watchPolling.pollWatches([buildWatch('owner/name')]);

        expect(
          allEvents.emittedEvents
            .map(({ name }) => name)
            .filter((name) => name !== 'watch.updated'),
        ).toEqual(['snapshot.changed', 'ticket.closed']);
      });
    });

    describe('polling', () => {
      it('should snapshot and announce every ticket as added when the repository has no snapshot', async () => {
        const { watchPolling, ticketSource, events } = createSubject();
        ticketSource.snapshotToReturn = buildSnapshot(startedAt, [
          buildTicket({ number: 1 }),
          buildTicket({ number: 2 }),
        ]);

        const [watch] = await watchPolling.pollWatches([buildWatch('owner/name')]);

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
        const { watchPolling, issueFeeds, ticketSource, clock, events } = createSubject();
        const [firstWatch] = await watchPolling.pollWatches([buildWatch('owner/name')]);
        clock.setNow('2026-09-28T12:00:30.000Z');

        const [secondWatch] = await watchPolling.pollWatches([firstWatch as RepositoryWatch]);

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
        const { watchPolling, issueFeeds, ticketSource, clock, events } = createSubject();
        const [firstWatch] = await watchPolling.pollWatches([buildWatch('owner/name')]);
        clock.setNow('2026-09-28T12:00:30.000Z');
        issueFeeds.changed = true;
        ticketSource.snapshotToReturn = buildSnapshot('2026-09-28T12:00:30.000Z', [
          buildTicket({ number: 1, status: 'ready' }),
        ]);

        const [secondWatch] = await watchPolling.pollWatches([firstWatch as RepositoryWatch]);

        expect(events.emittedEvents.at(-1)?.payload).toEqual({
          projectId: 'owner/name',
          addedTicketNumbers: [],
          changedTicketNumbers: [1],
          removedTicketNumbers: [],
        });
        expect(secondWatch?.snapshot?.openTickets[0]?.status).toBe('ready');
      });

      it('should not announce anything when a snapshot is identical to the last', async () => {
        const { watchPolling, ticketSource, clock, events } = createSubject();
        const [firstWatch] = await watchPolling.pollWatches([buildWatch('owner/name')]);
        clock.setNow('2026-09-28T12:06:00.000Z');

        await watchPolling.pollWatches([firstWatch as RepositoryWatch]);

        expect(ticketSource.snapshotRequests).toHaveLength(2);
        expect(events.emittedEvents).toHaveLength(1);
      });

      it('should snapshot again on the next poll when a snapshot failed after a feed changed', async () => {
        const { watchPolling, issueFeeds, ticketSource, clock } = createSubject();
        issueFeeds.changed = true;
        ticketSource.failure = new GitHubRequestError('GitHub answered 502');
        const [failedWatch] = await watchPolling.pollWatches([buildWatch('owner/name')]);
        issueFeeds.changed = false;
        ticketSource.failure = undefined;
        clock.setNow('2026-09-28T12:00:30.000Z');

        const [recoveredWatch] = await watchPolling.pollWatches([failedWatch as RepositoryWatch]);

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
        const { watchPolling, ticketSource } = createSubject();
        ticketSource.failuresByRepositoryName.set('first', new GitHubRequestError('gone'));

        const [firstWatch, secondWatch] = await watchPolling.pollWatches([
          buildWatch('owner/first'),
          buildWatch('owner/second'),
        ]);

        expect(firstWatch?.sync.state).toBe('failed');
        expect(secondWatch?.sync.state).toBe('ok');
      });

      it('should keep the polled repositories and continue when one fails with an unknown error', async () => {
        const { watchPolling, ticketSource, events } = createSubject();
        ticketSource.failuresByRepositoryName.set('second', new TypeError('malformed answer'));

        const watches = await watchPolling.pollWatches([
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
        const { watchPolling, issueFeeds, ticketSource, clock } = createSubject();
        const [goodWatch] = await watchPolling.pollWatches([buildWatch('owner/name')]);
        issueFeeds.failure = new GitHubAuthError('GitHub rejected the gh token: run gh auth login');
        clock.setNow('2026-09-28T12:00:30.000Z');

        const [failedWatch] = await watchPolling.pollWatches([goodWatch as RepositoryWatch]);

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
          const watches = await subject.watchPolling.pollWatches([
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
          const { watchPolling, watches, issueFeeds, clock } = await rateLimit();
          clock.setNow('2026-09-28T12:05:00.000Z');

          const gatedWatches = await watchPolling.pollWatches(watches);

          expect(issueFeeds.requests).toHaveLength(1);
          expect(gatedWatches[0]?.sync).toMatchObject({
            state: 'failed',
            cause: 'rate-limited',
            retryAt: retryAt.toISOString(),
          });
        });

        it('should snapshot on the first poll after the retry time', async () => {
          const { watchPolling, watches, issueFeeds, ticketSource, clock } = await rateLimit();
          issueFeeds.failure = undefined;
          clock.setNow('2026-09-28T12:10:00.000Z');

          const resumedWatches = await watchPolling.pollWatches(watches);

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
          emit: (name: string, payload: Readonly<Record<string, unknown>>) => {
            if (name === 'watch.updated' && typeof payload.projectId === 'string') {
              seen.push({
                projectId: payload.projectId,
                watch: watchStore.watch(payload.projectId),
                writeCount: watchStore.statusWrites(payload.projectId).length,
              });
            }
          },
        };
        const watchPolling = new RepositoryWatchService({
          ...unusedRepositoryWatchDependencies,
          issueFeeds,
          ticketSource,
          clock,
          events,
          watchStore,
          snapshotIntervalMilliseconds,
        });
        return { watchPolling, issueFeeds, ticketSource, clock, watchStore, seen };
      }

      it('should snapshot a forced repository when its feeds are unchanged and its snapshot is fresh', async () => {
        const { watchPolling, repositoryWatchService, watchStore, issueFeeds, ticketSource } =
          createSubject();
        await watchPolling.pollWatches([buildWatch('owner/name')]);
        ticketSource.snapshotToReturn = buildSnapshot(startedAt, [
          buildTicket({ number: 1 }),
          buildTicket({ number: 2 }),
        ]);

        await repositoryWatchService.poll([{ owner: 'owner', name: 'name' }]);

        expect(ticketSource.snapshotRequests).toHaveLength(2);
        expect(issueFeeds.requests).toHaveLength(1);
        expect(watchStore.watch('owner/name')?.snapshot?.openTickets).toHaveLength(2);
      });

      it('should skip the snapshot of an unforced repository when the feeds are unchanged', async () => {
        const { watchPolling, repositoryWatchService, ticketSource } = createSubject();
        await watchPolling.pollWatches([buildWatch('owner/name'), buildWatch('owner/other')]);

        await repositoryWatchService.poll([{ owner: 'owner', name: 'name' }]);

        expect(ticketSource.snapshotRequests.map(({ name }) => name)).toEqual([
          'name',
          'other',
          'name',
        ]);
      });

      it('should announce a watch after its poll is stored when the feeds are unchanged', async () => {
        const { watchPolling, watchStore, clock, seen } = createObservedSubject();
        watchStore.saveWatch(buildWatch('octo/repo'));
        await watchPolling.poll();
        clock.setNow('2026-09-28T12:00:30.000Z');
        seen.length = 0;

        await watchPolling.poll();

        expect(seen).toHaveLength(1);
        expect(seen[0]?.projectId).toBe('octo/repo');
        expect(seen[0]?.watch?.sync).toMatchObject({
          state: 'ok',
          checkedAt: '2026-09-28T12:00:30.000Z',
        });
      });

      it('should show each project its own poll when several projects are polled', async () => {
        const { watchPolling, watchStore, seen } = createObservedSubject();
        watchStore.saveWatch(buildWatch('octo/one'));
        watchStore.saveWatch(buildWatch('octo/two'));

        await watchPolling.poll();

        expect(seen.map((entry) => entry.projectId)).toEqual(['octo/one', 'octo/two']);
        expect(seen[0]?.watch?.snapshot?.openTickets.map((ticket) => ticket.number)).toEqual([1]);
        expect(seen[0]?.watch?.sync.state).toBe('ok');
      });

      it('should announce a failed watch when GitHub answers with a rate limit', async () => {
        const { watchPolling, watchStore, ticketSource, seen } = createObservedSubject();
        ticketSource.failure = new GitHubRateLimitedError(
          'limited',
          new Date('2026-09-28T13:00:00.000Z'),
        );
        watchStore.saveWatch(buildWatch('octo/repo'));

        await watchPolling.poll();

        expect(seen).toHaveLength(1);
        expect(seen[0]?.watch?.sync).toMatchObject({ state: 'failed', cause: 'rate-limited' });
      });

      it('should announce after an expired status write is pruned when the write is unconfirmed', async () => {
        const { watchPolling, watchStore, clock, seen } = createObservedSubject();
        watchStore.saveWatch(buildWatch('octo/repo'));
        await watchPolling.poll();
        seen.length = 0;
        watchStore.saveStatusWrite('octo/repo', {
          ticketNumber: 1,
          from: 'in-progress',
          to: 'ready',
          waiting: false,
          stuck: false,
          writtenAt: startedAt,
        });
        clock.setNow('2026-09-28T12:01:01.000Z');

        await watchPolling.poll();

        expect(seen).toHaveLength(1);
        expect(seen[0]?.writeCount).toBe(0);
      });
    });

    describe('watch.updated payload', () => {
      const later = '2026-09-28T12:00:30.000Z';

      function announcements(allEvents: {
        emittedEvents: ReadonlyArray<{ name: string; payload: unknown }>;
      }) {
        return allEvents.emittedEvents
          .filter((event) => event.name === 'watch.updated')
          .map((event) => event.payload);
      }

      async function pollTwice(prepare?: (subject: ReturnType<typeof createSubject>) => void) {
        const subject = createSubject();
        const [firstWatch] = await subject.watchPolling.pollWatches([buildWatch('owner/name')]);
        subject.clock.setNow(later);
        prepare?.(subject);
        await subject.watchPolling.pollWatches([firstWatch as RepositoryWatch]);
        return { ...subject, firstWatch: firstWatch as RepositoryWatch };
      }

      it('should emit changed false and the clock time when nothing changed', async () => {
        const { allEvents } = await pollTwice();

        expect(announcements(allEvents).at(-1)).toEqual({
          projectId: 'owner/name',
          changed: false,
          polledAt: later,
        });
      });

      it('should emit changed true when a ticket differs, is new or is gone', async () => {
        for (const tickets of [
          [buildTicket({ number: 1, status: 'ready' })],
          [buildTicket({ number: 1 }), buildTicket({ number: 2 })],
          [],
        ]) {
          const { allEvents } = await pollTwice(({ issueFeeds, ticketSource }) => {
            issueFeeds.changed = true;
            ticketSource.snapshotToReturn = buildSnapshot(later, tickets);
          });

          expect(announcements(allEvents).at(-1)).toMatchObject({ changed: true });
        }
      });

      it('should emit changed true when the first poll finds no tickets in a pending watch', async () => {
        const { watchPolling, ticketSource, allEvents } = createSubject();
        ticketSource.snapshotToReturn = buildSnapshot(startedAt, []);

        await watchPolling.pollWatches([buildWatch('owner/name')]);

        expect(announcements(allEvents)).toEqual([
          { projectId: 'owner/name', changed: true, polledAt: startedAt },
        ]);
      });

      it('should emit changed true when the first poll after start finds tickets', async () => {
        const { watchPolling, allEvents } = createSubject();

        await watchPolling.pollWatches([buildWatch('owner/name')]);

        expect(announcements(allEvents)).toMatchObject([{ changed: true }]);
      });

      it('should emit changed true when the poll recovers from a failure with the same tickets', async () => {
        const { watchPolling, allEvents, firstWatch } = await pollTwice();
        const failedWatch: RepositoryWatch = {
          ...firstWatch,
          sync: {
            state: 'failed',
            cause: 'unavailable',
            message: 'down',
            failedAt: startedAt,
            snapshotTakenAt: startedAt,
          },
        };

        await watchPolling.pollWatches([failedWatch]);

        expect(announcements(allEvents).at(-1)).toMatchObject({ changed: true });
      });

      it('should emit changed true when a failure or a rate-limit pause starts', async () => {
        const failing = await pollTwice(({ issueFeeds }) => {
          issueFeeds.failure = new GitHubRequestError('down');
        });
        const limited = await pollTwice(({ issueFeeds }) => {
          issueFeeds.failure = new GitHubRateLimitedError(
            'limited',
            new Date('2026-09-28T12:10:00.000Z'),
          );
        });

        expect(announcements(failing.allEvents).at(-1)).toMatchObject({ changed: true });
        expect(announcements(limited.allEvents).at(-1)).toMatchObject({ changed: true });
      });

      it('should emit changed false when the same rate-limit pause repeats', async () => {
        const subject = createSubject();
        subject.issueFeeds.failure = new GitHubRateLimitedError(
          'limited',
          new Date('2026-09-28T12:10:00.000Z'),
        );
        const [pausedWatch] = await subject.watchPolling.pollWatches([buildWatch('owner/name')]);
        subject.clock.setNow(later);

        await subject.watchPolling.pollWatches([pausedWatch as RepositoryWatch]);

        expect(announcements(subject.allEvents).at(-1)).toEqual({
          projectId: 'owner/name',
          changed: false,
          polledAt: later,
        });
      });

      it('should emit changed true when a different failure follows', async () => {
        const subject = createSubject();
        subject.issueFeeds.failure = new GitHubRequestError('first');
        const [failedWatch] = await subject.watchPolling.pollWatches([buildWatch('owner/name')]);
        subject.issueFeeds.failure = new GitHubRequestError('second');
        subject.clock.setNow(later);

        await subject.watchPolling.pollWatches([failedWatch as RepositoryWatch]);

        expect(announcements(subject.allEvents).at(-1)).toMatchObject({ changed: true });
      });

      it('should emit changed true when pruning removes an unconfirmed status write', async () => {
        const subject = createSubject();
        const [firstWatch] = await subject.watchPolling.pollWatches([buildWatch('owner/name')]);
        subject.watchStore.saveStatusWrite('owner/name', {
          ticketNumber: 1,
          from: 'in-progress',
          to: 'ready',
          waiting: false,
          stuck: false,
          writtenAt: startedAt,
        });
        subject.clock.setNow('2026-09-28T12:01:01.000Z');

        await subject.watchPolling.pollWatches([firstWatch as RepositoryWatch]);

        expect(announcements(subject.allEvents).at(-1)).toMatchObject({ changed: true });
      });
    });
  });

  describe('failWatches', () => {
    const now = '2026-09-28T12:00:00.000Z';

    it('should fail and announce every watch when a poll fails unexpectedly', () => {
      const watchStore = new InMemoryWatchStore();
      const events = new FakeEventPublisher();
      for (const projectId of ['octo/one', 'octo/two']) {
        const [owner = '', name = ''] = projectId.split('/');
        watchStore.saveWatch({
          projectId,
          repository: { owner, name },
          sync: { state: 'pending' },
        });
      }

      new RepositoryWatchService({
        ...unusedRepositoryWatchDependencies,
        watchStore,
        clock: new FakeClock(now),
        events,
      }).failWatches(new Error('boom'));

      expect(watchStore.watches().map((watch) => watch.sync)).toEqual([
        expect.objectContaining({ state: 'failed', cause: 'unexpected', message: 'boom' }),
        expect.objectContaining({ state: 'failed', cause: 'unexpected', message: 'boom' }),
      ]);
      expect(events.emittedEvents).toEqual([
        { name: 'watch.updated', payload: { projectId: 'octo/one', changed: true, polledAt: now } },
        { name: 'watch.updated', payload: { projectId: 'octo/two', changed: true, polledAt: now } },
      ]);
    });

    it('should announce changed false when the same error repeats', () => {
      const watchStore = new InMemoryWatchStore();
      const events = new FakeEventPublisher();
      watchStore.saveWatch({
        projectId: 'octo/one',
        repository: { owner: 'octo', name: 'one' },
        sync: { state: 'ok', checkedAt: now, snapshotTakenAt: now },
      });
      const watchPolling = new RepositoryWatchService({
        ...unusedRepositoryWatchDependencies,
        watchStore,
        clock: new FakeClock(now),
        events,
      });

      watchPolling.failWatches(new Error('boom'));
      watchPolling.failWatches(new Error('boom'));

      expect(events.emittedEvents.map((event) => event.payload)).toEqual([
        { projectId: 'octo/one', changed: true, polledAt: now },
        { projectId: 'octo/one', changed: false, polledAt: now },
      ]);
    });
  });

  describe('recordStatusWrite', () => {
    it('should store the write with the clock time when a write is recorded', () => {
      const watchStore = new InMemoryWatchStore();
      const now = '2026-09-28T12:00:00.000Z';

      new RepositoryWatchService({
        ...unusedRepositoryWatchDependencies,
        watchStore,
        clock: new FakeClock(now),
      }).recordStatusWrite('octo/repo', {
        ticketNumber: 7,
        from: 'in-progress',
        to: 'ready',
        waiting: false,
        stuck: false,
      });

      expect(watchStore.statusWrites('octo/repo')).toEqual([
        {
          ticketNumber: 7,
          from: 'in-progress',
          to: 'ready',
          waiting: false,
          stuck: false,
          writtenAt: now,
        },
      ]);
    });
  });

  describe('watch', () => {
    it('should add a pending watch when the project has none', () => {
      const watchStore = new InMemoryWatchStore();

      new RepositoryWatchService({ ...unusedRepositoryWatchDependencies, watchStore }).watch(
        'octo/new',
        { owner: 'octo', name: 'new' },
      );

      expect(watchStore.watch('octo/new')?.sync).toEqual({ state: 'pending' });
    });

    it('should keep the existing watch when the project is already watched', () => {
      const watchStore = new InMemoryWatchStore();
      const existing = {
        projectId: 'octo/repo',
        repository: { owner: 'octo', name: 'repo' },
        sync: { state: 'ok' as const, checkedAt: 'x', snapshotTakenAt: 'x' },
      };
      watchStore.saveWatch(existing);

      new RepositoryWatchService({ ...unusedRepositoryWatchDependencies, watchStore }).watch(
        'octo/repo',
        {
          owner: 'octo',
          name: 'repo',
        },
      );

      expect(watchStore.watch('octo/repo')).toBe(existing);
    });
  });

  describe('refresh', () => {
    it('should snapshot the repository and resolve when its feeds report no change', async () => {
      const ticketSource = new FakeTicketSource({
        takenAt: '2026-09-28T12:00:00.000Z',
        openTickets: [buildTicket({ number: 1 })],
        recentlyClosedTickets: [],
        closedTotalCount: 0,
      });
      const watchStore = new InMemoryWatchStore();
      const service = new RepositoryWatchService({
        ...unusedRepositoryWatchDependencies,
        issueFeeds: new FakeIssueFeeds(),
        ticketSource,
        clock: new FakeClock('2026-09-28T12:00:00.000Z'),
        events: new FakeEventPublisher(),
        watchStore,
        pollIntervalMilliseconds: 30_000,
        snapshotIntervalMilliseconds: 300_000,
      });
      service.watch('octo/repo', { owner: 'octo', name: 'repo' });

      await service.refresh({ owner: 'octo', name: 'repo' });
      service.stopWatching();

      expect(watchStore.watch('octo/repo')?.snapshot?.openTickets).toHaveLength(1);
    });
  });

  describe('watchAndPoll', () => {
    it('should watch the repository and take its snapshot when a project is added', async () => {
      const watchStore = new InMemoryWatchStore();
      const service = new RepositoryWatchService({
        ...unusedRepositoryWatchDependencies,
        issueFeeds: new FakeIssueFeeds(),
        ticketSource: new FakeTicketSource({
          takenAt: '2026-09-28T12:00:00.000Z',
          openTickets: [buildTicket({ number: 1 })],
          recentlyClosedTickets: [],
          closedTotalCount: 0,
        }),
        clock: new FakeClock('2026-09-28T12:00:00.000Z'),
        events: new FakeEventPublisher(),
        watchStore,
        pollIntervalMilliseconds: 30_000,
        snapshotIntervalMilliseconds: 300_000,
      });

      await service.watchAndPoll('octo/repo', { owner: 'octo', name: 'repo' });
      service.stopWatching();

      expect(watchStore.watch('octo/repo')?.snapshot?.openTickets).toHaveLength(1);
    });
  });

  describe('recordStatusWriteAndPoll', () => {
    it('should store the write and poll when a status write is announced', async () => {
      const watchStore = new InMemoryWatchStore();
      const events = new FakeEventPublisher();
      const service = new RepositoryWatchService({
        ...unusedRepositoryWatchDependencies,
        issueFeeds: new FakeIssueFeeds(),
        ticketSource: new FakeTicketSource({
          takenAt: '2026-09-28T12:00:00.000Z',
          openTickets: [],
          recentlyClosedTickets: [],
          closedTotalCount: 0,
        }),
        clock: new FakeClock('2026-09-28T12:00:00.000Z'),
        events,
        watchStore,
        pollIntervalMilliseconds: 30_000,
        snapshotIntervalMilliseconds: 300_000,
      });
      service.watch('octo/repo', { owner: 'octo', name: 'repo' });

      await service.recordStatusWriteAndPoll('octo/repo', {
        ticketNumber: 7,
        from: 'in-progress',
        to: 'ready',
        waiting: false,
        stuck: false,
      });
      service.stopWatching();

      expect(events.emittedEvents.map((event) => event.name)).toContain('watch.updated');
    });
  });
});
