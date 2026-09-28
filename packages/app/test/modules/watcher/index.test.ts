import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createWatcherModule } from '../../../src/modules/watcher/index.js';
import type { AisfEventMap } from '../../../src/shared/bus/aisf-event-map.js';
import { TypedEventBus } from '../../../src/shared/bus/typed-event-bus.js';
import { FakeClock } from '../../fakes/fake-clock.js';
import { buildTicket } from './fakes/build-ticket.js';
import {
  FakeIssueFeeds,
  FakeRegisteredRepositories,
  FakeTicketSource,
} from './fakes/fake-watcher-ports.js';

const startedAt = '2026-09-28T12:00:00.000Z';
const pollIntervalMilliseconds = 30_000;
const snapshotIntervalMilliseconds = 300_000;
const registered = { projectId: 'owner/name', repository: { owner: 'owner', name: 'name' } };

function createSubject() {
  const events = new TypedEventBus<AisfEventMap>();
  const issueFeeds = new FakeIssueFeeds();
  const ticketSource = new FakeTicketSource({
    takenAt: startedAt,
    openTickets: [buildTicket({ number: 1 }), buildTicket({ number: 2 })],
    recentlyClosedTickets: [],
    closedTotalCount: 0,
  });
  const clock = new FakeClock(startedAt);
  const snapshotChanges: Array<AisfEventMap['snapshot.changed']> = [];
  events.on('snapshot.changed', (payload) => snapshotChanges.push(payload));
  const watcher = createWatcherModule({
    issueFeeds,
    ticketSource,
    clock,
    events,
    subscriber: events,
    registeredRepositories: new FakeRegisteredRepositories([registered]),
    pollIntervalMilliseconds,
    snapshotIntervalMilliseconds,
  });
  return { watcher, events, issueFeeds, ticketSource, clock, snapshotChanges };
}

describe('createWatcherModule', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('openTickets', () => {
    it('should list every open ticket of the snapshot when the project is watched', async () => {
      const { watcher } = createSubject();

      await watcher.start();
      watcher.stop();

      expect(watcher.openTickets('owner/name').map((ticket) => ticket.number)).toEqual([1, 2]);
    });

    it('should list nothing when the project is unknown', async () => {
      const { watcher } = createSubject();

      await watcher.start();
      watcher.stop();

      expect(watcher.openTickets('other/project')).toEqual([]);
    });
  });

  describe('start', () => {
    it('should take the first snapshot and show every ticket when a repository is registered', async () => {
      const { watcher, snapshotChanges } = createSubject();

      await watcher.start();
      watcher.stop();

      expect(snapshotChanges).toEqual([
        {
          projectId: 'owner/name',
          addedTicketNumbers: [1, 2],
          changedTicketNumbers: [],
          removedTicketNumbers: [],
        },
      ]);
      const projectBoard = watcher.board('owner/name');
      expect(projectBoard?.sync.state).toBe('ok');
      expect(projectBoard?.board?.rows.find((row) => row.key === 'idea')?.tickets).toHaveLength(2);
    });

    it('should poll again after the poll interval without taking a snapshot when nothing changed', async () => {
      const { watcher, issueFeeds, ticketSource } = createSubject();
      await watcher.start();

      await vi.advanceTimersByTimeAsync(pollIntervalMilliseconds);
      watcher.stop();

      expect(issueFeeds.requests).toHaveLength(2);
      expect(ticketSource.snapshotRequests).toHaveLength(1);
    });

    it('should show a label change in its new row within one poll interval', async () => {
      const { watcher, issueFeeds, ticketSource, snapshotChanges } = createSubject();
      await watcher.start();
      issueFeeds.changed = true;
      ticketSource.snapshotToReturn = {
        takenAt: startedAt,
        openTickets: [buildTicket({ number: 1, status: 'ready' }), buildTicket({ number: 2 })],
        recentlyClosedTickets: [],
        closedTotalCount: 0,
      };

      await vi.advanceTimersByTimeAsync(pollIntervalMilliseconds);
      watcher.stop();

      const readyRow = watcher.board('owner/name')?.board?.rows.find((row) => row.key === 'ready');
      expect(readyRow?.tickets.map((ticket) => ticket.number)).toEqual([1]);
      expect(snapshotChanges.at(-1)?.changedTicketNumbers).toEqual([1]);
    });

    it('should take a snapshot when the safety-net interval has passed and the feeds are unchanged', async () => {
      const { watcher, clock, ticketSource } = createSubject();
      await watcher.start();
      clock.setNow('2026-09-28T12:05:00.000Z');

      await vi.advanceTimersByTimeAsync(pollIntervalMilliseconds);
      watcher.stop();

      expect(ticketSource.snapshotRequests).toHaveLength(2);
    });

    it('should never overlap passes when a pass takes longer than the poll interval', async () => {
      const { watcher, issueFeeds, ticketSource } = createSubject();
      let finishSnapshot: () => void = () => undefined;
      ticketSource.release = new Promise((resolve) => {
        finishSnapshot = resolve;
      });
      const started = watcher.start();

      await vi.advanceTimersByTimeAsync(pollIntervalMilliseconds * 5);
      expect(issueFeeds.requests).toHaveLength(1);
      finishSnapshot();
      await started;
      watcher.stop();

      expect(issueFeeds.requests).toHaveLength(1);
    });

    it('should show failed/unexpected and keep polling when a pass throws an unknown error', async () => {
      const { watcher, issueFeeds } = createSubject();
      issueFeeds.failure = new TypeError('boom');

      await watcher.start();
      const failedSync = watcher.board('owner/name')?.sync;
      issueFeeds.failure = undefined;
      await vi.advanceTimersByTimeAsync(pollIntervalMilliseconds);
      watcher.stop();

      expect(failedSync).toMatchObject({ state: 'failed', cause: 'unexpected', message: 'boom' });
      expect(watcher.board('owner/name')?.sync.state).toBe('ok');
    });
  });

  describe('project.added', () => {
    it('should poll the new repository at once when a project is added', async () => {
      const { watcher, events, ticketSource } = createSubject();
      await watcher.start();

      events.emit('project.added', {
        projectId: 'owner/other',
        repository: { owner: 'owner', name: 'other' },
        checkoutPath: '/checkout',
      });
      await vi.advanceTimersByTimeAsync(0);
      watcher.stop();

      expect(ticketSource.snapshotRequests.map((request) => request.name)).toEqual([
        'name',
        'other',
      ]);
      expect(watcher.board('owner/other')?.sync.state).toBe('ok');
    });
  });

  describe('board', () => {
    it('should return undefined when the project is not watched', async () => {
      const { watcher } = createSubject();
      await watcher.start();
      watcher.stop();

      expect(watcher.board('owner/unknown')).toBeUndefined();
    });

    it('should return a pending status without a board before the first pass settles', async () => {
      const { watcher, ticketSource } = createSubject();
      ticketSource.release = new Promise(() => undefined);
      void watcher.start();
      await vi.advanceTimersByTimeAsync(0);
      watcher.stop();

      expect(watcher.board('owner/name')).toEqual({
        projectId: 'owner/name',
        sync: { state: 'pending' },
      });
    });
  });

  describe('ticket', () => {
    it('should return undefined when the project is not watched', async () => {
      const { watcher } = createSubject();
      await watcher.start();
      watcher.stop();

      expect(await watcher.ticket('owner/unknown', 1)).toBeUndefined();
    });

    it('should serve an open ticket from the snapshot when the project is watched', async () => {
      const { watcher, ticketSource } = createSubject();
      await watcher.start();
      watcher.stop();

      const projectTicket = await watcher.ticket('owner/name', 1);

      expect(projectTicket?.ticket?.number).toBe(1);
      expect(projectTicket?.sync.state).toBe('ok');
      expect(ticketSource.ticketRequests).toHaveLength(0);
    });

    it('should return undefined when the ticket does not exist', async () => {
      const { watcher } = createSubject();
      await watcher.start();
      watcher.stop();

      expect(await watcher.ticket('owner/name', 99)).toBeUndefined();
    });
  });
});
