import { describe, expect, it } from 'vitest';
import type { RepositoryWatch } from '../../../../../src/modules/watcher/logic/domain/types/repository-watch.js';
import type { SyncStatus } from '../../../../../src/modules/watcher/logic/domain/types/sync-status.js';
import type { TicketSnapshot } from '../../../../../src/modules/watcher/logic/domain/types/ticket-snapshot.js';
import { GitHubAuthError } from '../../../../../src/modules/watcher/logic/errors/github-auth-error.js';
import { GitHubRateLimitedError } from '../../../../../src/modules/watcher/logic/errors/github-rate-limited-error.js';
import { GitHubRequestError } from '../../../../../src/modules/watcher/logic/errors/github-request-error.js';
import { ReadTicketUseCase } from '../../../../../src/modules/watcher/logic/use-cases/read-ticket-use-case.js';
import { FakeClock } from '../../../../fakes/fake-clock.js';
import { buildTicket } from '../../fakes/build-ticket.js';
import { FakeTicketSource } from '../../fakes/fake-watcher-ports.js';

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
  const useCase = new ReadTicketUseCase({ ticketSource, clock: new FakeClock(now) });
  return { useCase, ticketSource };
}

describe('ReadTicketUseCase', () => {
  describe('execute', () => {
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
});
