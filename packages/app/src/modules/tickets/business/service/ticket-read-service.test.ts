import { describe, expect, it } from 'vitest';
import type { RepositoryWatch } from '../domain/types/repository-watch.js';
import type { SyncStatus } from '../domain/types/sync-status.js';
import type { TicketSnapshot } from '../domain/types/ticket-snapshot.js';
import { GitHubAuthError } from '../errors/github-auth-error.js';
import { GitHubRateLimitedError } from '../errors/github-rate-limited-error.js';
import { GitHubRequestError } from '../errors/github-request-error.js';
import { InMemoryWatchStore } from '../../infrastructure/repository/in-memory-watch-store.js';
import { FakeClock } from '../../../../shared/testing/fake-clock.js';
import { buildTicket } from '../../testing/build-ticket.js';
import { FakeTicketSource } from '../../testing/fake-tickets-ports.js';
import type { RunPort } from '../port/run/run-port.js';
import type { RunWait } from '../port/run/run-port.js';
import type { Ticket } from '../domain/types/ticket.js';
import { TicketReadService } from './ticket-read-service.js';
import { unusedTicketReadDependencies } from '../../testing/unused-dependencies.js';

describe('TicketReadService', () => {
  describe('readTicket', () => {
    const now = '2026-09-28T12:00:00.000Z';
    const okSync: SyncStatus = { state: 'ok', checkedAt: now, snapshotTakenAt: now };

    const openTicket = buildTicket({ number: 1, status: 'ready', body: 'Open body' });
    const staleClosedTicket = buildTicket({
      number: 2,
      status: 'closed',
      title: 'Stale title',
      body: 'Stale body',
    });
    const freshClosedTicket = buildTicket({
      number: 2,
      status: 'closed',
      title: 'Fresh title',
      body: 'Fresh body',
    });
    const snapshot: TicketSnapshot = {
      takenAt: now,
      openTickets: [openTicket],
      recentlyClosedTickets: [staleClosedTicket],
      closedTotalCount: 1,
    };

    function buildWatch(overrides: Partial<RepositoryWatch> = {}): RepositoryWatch {
      return {
        projectId: 'owner/name',
        repository: { owner: 'owner', name: 'name' },
        snapshot,
        sync: okSync,
        ...overrides,
      };
    }

    function createSubject() {
      const ticketSource = new FakeTicketSource(
        snapshot,
        new Map([
          [2, freshClosedTicket],
          [3, buildTicket({ number: 3, status: 'closed' })],
        ]),
      );
      const watchStore = new InMemoryWatchStore();
      const readTicket = new TicketReadService({
        ...unusedTicketReadDependencies,
        ticketSource,
        clock: new FakeClock(now),
        watchStore,
      });
      const useCase = {
        execute: (watch: RepositoryWatch, number: number) => {
          watchStore.saveWatch(watch);
          return readTicket.readTicket(watch.projectId, number);
        },
      };
      return { useCase, ticketSource };
    }

    it('should serve an open ticket from the snapshot without calling GitHub', async () => {
      const { useCase, ticketSource } = createSubject();

      const projectTicket = await useCase.execute(buildWatch(), 1);

      expect(projectTicket).toEqual({ projectId: 'owner/name', sync: okSync, ticket: openTicket });
      expect(ticketSource.ticketRequests).toHaveLength(0);
    });

    it('should carry the snapshot body when an open ticket is served from the snapshot', async () => {
      const { useCase, ticketSource } = createSubject();

      const projectTicket = await useCase.execute(buildWatch(), 1);

      expect(projectTicket?.ticket?.body).toBe('Open body');
      expect(ticketSource.ticketRequests).toHaveLength(0);
    });

    it('should carry the live body with the live title when a closed ticket is fetched live', async () => {
      const { useCase } = createSubject();

      const projectTicket = await useCase.execute(buildWatch(), 2);

      expect(projectTicket?.ticket).toMatchObject({ title: 'Fresh title', body: 'Fresh body' });
    });

    it('should fetch a recently closed ticket live when it is in the snapshot', async () => {
      const { useCase, ticketSource } = createSubject();

      const projectTicket = await useCase.execute(buildWatch(), 2);

      expect(projectTicket?.ticket).toBe(freshClosedTicket);
      expect(ticketSource.ticketRequests).toEqual([
        { repository: { owner: 'owner', name: 'name' }, number: 2 },
      ]);
    });

    it('should fetch a closed ticket live on every call when it is outside the recent closed', async () => {
      const { useCase, ticketSource } = createSubject();

      await useCase.execute(buildWatch(), 3);
      await useCase.execute(buildWatch(), 3);

      expect(ticketSource.ticketRequests).toHaveLength(2);
    });

    it('should fetch live when the repository has no snapshot yet', async () => {
      const { useCase } = createSubject();
      const pendingWatch: RepositoryWatch = {
        projectId: 'owner/name',
        repository: { owner: 'owner', name: 'name' },
        sync: { state: 'pending' },
      };

      const projectTicket = await useCase.execute(pendingWatch, 3);

      expect(projectTicket?.ticket?.number).toBe(3);
      expect(projectTicket?.sync).toEqual({ state: 'pending' });
    });

    it('should return undefined when GitHub does not know the number', async () => {
      const { useCase } = createSubject();

      expect(await useCase.execute(buildWatch(), 99)).toBeUndefined();
    });

    it('should leave the snapshot untouched when a ticket is fetched live', async () => {
      const { useCase } = createSubject();
      const watch = buildWatch();

      await useCase.execute(watch, 3);

      expect(watch.snapshot?.recentlyClosedTickets).toEqual([staleClosedTicket]);
    });

    it('should report the rate limit with the snapshot copy and make no call when the watcher is paused', async () => {
      const { useCase, ticketSource } = createSubject();
      const pausedSync: SyncStatus = {
        state: 'failed',
        cause: 'rate-limited',
        message: 'rate limited until 12:10',
        failedAt: now,
        retryAt: '2026-09-28T12:10:00.000Z',
        snapshotTakenAt: now,
      };

      const projectTicket = await useCase.execute(buildWatch({ sync: pausedSync }), 2);

      expect(projectTicket).toEqual({
        projectId: 'owner/name',
        sync: pausedSync,
        ticket: staleClosedTicket,
      });
      expect(ticketSource.ticketRequests).toHaveLength(0);
    });

    it('should report the failure with the snapshot copy when the live fetch fails', async () => {
      const { useCase, ticketSource } = createSubject();
      ticketSource.ticketFailure = new GitHubAuthError('run gh auth login');

      const projectTicket = await useCase.execute(buildWatch(), 2);

      expect(projectTicket).toEqual({
        projectId: 'owner/name',
        sync: {
          state: 'failed',
          cause: 'auth',
          message: 'run gh auth login',
          failedAt: now,
          snapshotTakenAt: now,
        },
        ticket: staleClosedTicket,
      });
    });

    it('should report the failure without a ticket when the live fetch fails and no copy exists', async () => {
      const { useCase, ticketSource } = createSubject();
      ticketSource.ticketFailure = new GitHubRequestError('GitHub answered 502');

      const projectTicket = await useCase.execute(buildWatch(), 3);

      expect(projectTicket).toEqual({
        projectId: 'owner/name',
        sync: {
          state: 'failed',
          cause: 'unavailable',
          message: 'GitHub answered 502',
          failedAt: now,
          snapshotTakenAt: now,
        },
      });
    });

    it('should report rate-limited with the reset time when the live fetch is rate limited', async () => {
      const { useCase, ticketSource } = createSubject();
      ticketSource.ticketFailure = new GitHubRateLimitedError(
        'rate limited until 12:10',
        new Date('2026-09-28T12:10:00.000Z'),
      );

      const projectTicket = await useCase.execute(buildWatch(), 3);

      expect(projectTicket?.sync).toMatchObject({
        state: 'failed',
        cause: 'rate-limited',
        retryAt: '2026-09-28T12:10:00.000Z',
      });
    });
  });

  describe('readProjectBoard', () => {
    const watch: RepositoryWatch = {
      projectId: 'owner/name',
      repository: { owner: 'owner', name: 'name' },
      sync: { state: 'pending' },
    };

    function createSubject(runningTicketNumbers: ReadonlyArray<number>) {
      const requestedProjectIds: string[] = [];
      const runPort: Pick<RunPort, 'activeRunTicketNumbers' | 'waitsOf'> = {
        activeRunTicketNumbers: async (projectId) => {
          requestedProjectIds.push(projectId);
          return runningTicketNumbers;
        },
        waitsOf: async () => [],
      };
      const watchStore = new InMemoryWatchStore();
      watchStore.saveWatch(watch);
      const readProjectBoard = new TicketReadService({
        ...unusedTicketReadDependencies,
        runPort,
        watchStore,
      });
      return {
        subject: {
          execute: (target: RepositoryWatch) => readProjectBoard.readProjectBoard(target.projectId),
        },
        requestedProjectIds,
      };
    }

    it('should name every running ticket when the project has active runs', async () => {
      const { subject, requestedProjectIds } = createSubject([139, 140]);

      const projectBoard = await subject.execute(watch);

      expect(projectBoard).toEqual({
        projectId: 'owner/name',
        sync: { state: 'pending' },
        runningTicketNumbers: [139, 140],
      });
      expect(requestedProjectIds).toEqual(['owner/name']);
    });

    it('should name no running tickets when the project has no active run', async () => {
      const { subject } = createSubject([]);

      const projectBoard = await subject.execute(watch);

      expect(projectBoard).toEqual({
        projectId: 'owner/name',
        sync: { state: 'pending' },
        runningTicketNumbers: [],
      });
    });
  });

  describe('readOpenTickets', () => {
    it('should list the open tickets with unconfirmed status writes applied when the project is watched', () => {
      const watchStore = new InMemoryWatchStore();
      watchStore.saveWatch({
        projectId: 'octo/repo',
        repository: { owner: 'octo', name: 'repo' },
        sync: { state: 'ok', checkedAt: 'x', snapshotTakenAt: 'x' },
        snapshot: {
          takenAt: 'x',
          openTickets: [buildTicket({ number: 7, status: 'in-progress' })],
          recentlyClosedTickets: [],
          closedTotalCount: 0,
        },
      });
      watchStore.saveStatusWrite('octo/repo', {
        ticketNumber: 7,
        from: 'in-progress',
        to: 'ready',
        waiting: false,
        stuck: false,
        writtenAt: '2026-09-28T12:00:00.000Z',
      });

      const tickets = new TicketReadService({
        ...unusedTicketReadDependencies,
        watchStore,
      }).readOpenTickets('octo/repo');

      expect(tickets.map((ticket) => ticket.status)).toEqual(['ready']);
    });

    it('should list nothing when the project is unknown', () => {
      const useCase = new TicketReadService({
        ...unusedTicketReadDependencies,
        watchStore: new InMemoryWatchStore(),
      });

      expect(useCase.readOpenTickets('octo/none')).toEqual([]);
    });
  });

  describe('readNeedsYou', () => {
    function createSubject(openTickets: ReadonlyArray<Ticket>, waits: ReadonlyArray<RunWait>) {
      const watchStore = new InMemoryWatchStore();
      watchStore.saveWatch({
        projectId: 'octo/repo',
        repository: { owner: 'octo', name: 'repo' },
        sync: { state: 'ok', checkedAt: 'x', snapshotTakenAt: 'x' },
        snapshot: { takenAt: 'x', openTickets, recentlyClosedTickets: [], closedTotalCount: 0 },
      });
      const requestedProjectIds: string[] = [];
      const subject = new TicketReadService({
        ...unusedTicketReadDependencies,
        watchStore,
        runPort: {
          activeRunTicketNumbers: async () => [],
          waitsOf: async (projectId) => {
            requestedProjectIds.push(projectId);
            return waits;
          },
        },
      });
      return { subject, watchStore, requestedProjectIds };
    }

    it('should return the rows of the open tickets when the project is watched', async () => {
      const { subject, requestedProjectIds } = createSubject(
        [
          buildTicket({ number: 5, status: 'in-progress', waiting: true }),
          buildTicket({ number: 9, status: 'in-review', updatedAt: '2026-10-01T11:00:00Z' }),
        ],
        [{ ticketNumber: 5, kind: 'round', since: '2026-10-01T10:00:00Z' }],
      );

      const rows = await subject.readNeedsYou('octo/repo');

      expect(rows?.map((row) => [row.ticketNumber, row.action])).toEqual([
        [5, 'answer-round'],
        [9, 'review-pull-request'],
      ]);
      expect(requestedProjectIds).toEqual(['octo/repo']);
    });

    it('should count a just-written waiting label when no poll has confirmed it', async () => {
      const { subject, watchStore } = createSubject(
        [buildTicket({ number: 5, status: 'in-progress' })],
        [{ ticketNumber: 5, kind: 'question', since: '2026-10-01T10:00:00Z' }],
      );
      watchStore.saveStatusWrite('octo/repo', {
        ticketNumber: 5,
        from: 'in-progress',
        to: 'in-progress',
        waiting: true,
        stuck: false,
        writtenAt: '2026-10-01T10:00:00Z',
      });

      const rows = await subject.readNeedsYou('octo/repo');

      expect(rows?.map((row) => [row.ticketNumber, row.action])).toEqual([[5, 'answer-question']]);
    });

    it('should return no rows when the project has no snapshot yet', async () => {
      const watchStore = new InMemoryWatchStore();
      watchStore.saveWatch({
        projectId: 'octo/repo',
        repository: { owner: 'octo', name: 'repo' },
        sync: { state: 'pending' },
      });
      const subject = new TicketReadService({
        ...unusedTicketReadDependencies,
        watchStore,
        runPort: { activeRunTicketNumbers: async () => [], waitsOf: async () => [] },
      });

      expect(await subject.readNeedsYou('octo/repo')).toEqual([]);
    });

    it('should return undefined when the project is unknown', async () => {
      const { subject } = createSubject([], []);

      expect(await subject.readNeedsYou('octo/none')).toBeUndefined();
    });
  });
});
