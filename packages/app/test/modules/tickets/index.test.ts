import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InMemoryWatchStore } from '../../../src/modules/tickets/infra/integrations/in-memory-watch-store.js';
import { createTicketsModule } from '../../../src/modules/tickets/index.js';
import type { AisfEventMap } from '../../../src/shared/bus/aisf-event-map.js';
import { TypedEventBus } from '../../../src/shared/bus/typed-event-bus.js';
import { FakeClock } from '../../fakes/fake-clock.js';
import { buildTicket } from './fakes/build-ticket.js';
import {
  FakeIssueFeeds,
  FakeRegisteredRepositories,
  FakeTicketSource,
} from './fakes/fake-tickets-ports.js';

const startedAt = '2026-09-28T12:00:00.000Z';
const pollIntervalMilliseconds = 30_000;
const snapshotIntervalMilliseconds = 300_000;
const registered = { projectId: 'owner/name', repository: { owner: 'owner', name: 'name' } };

function createSubject(runningTicketNumbers: ReadonlyArray<number> = []) {
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
  const tickets = createTicketsModule({
    issueFeeds,
    ticketSource,
    clock,
    events,
    watchStore: new InMemoryWatchStore(),
    subscriber: events,
    registeredRepositories: new FakeRegisteredRepositories([registered]),
    activeRunLookup: { activeRunTicketNumbers: async () => runningTicketNumbers },
    pollIntervalMilliseconds,
    snapshotIntervalMilliseconds,
  });
  return { tickets, events, issueFeeds, ticketSource, clock, snapshotChanges };
}

type BoardBody = {
  readonly sync: { readonly state: string };
  readonly board?: {
    readonly rows: ReadonlyArray<{
      readonly key: string;
      readonly tickets: ReadonlyArray<{ readonly number: number }>;
    }>;
  };
};

async function readBoard(
  tickets: ReturnType<typeof createSubject>['tickets'],
  projectId: string,
): Promise<BoardBody | undefined> {
  const response = await tickets.routes.request(`/projects/${projectId}/board`);
  return response.status === 404 ? undefined : ((await response.json()) as BoardBody);
}

describe('createTicketsModule', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('routes', () => {
    it('should serve the board under /projects/:owner/:name/board when the project is watched', async () => {
      const { tickets } = createSubject();
      await tickets.start();
      tickets.stop();

      const response = await tickets.routes.request('/projects/owner/name/board');

      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ projectId: 'owner/name' });
    });

    it('should name the running tickets on the board when the project has active runs', async () => {
      const { tickets } = createSubject([139, 140]);
      await tickets.start();
      tickets.stop();

      const response = await tickets.routes.request('/projects/owner/name/board');

      expect(await response.json()).toMatchObject({ runningTicketNumbers: [139, 140] });
    });

    it('should name no running tickets on the board when the project has no active run', async () => {
      const { tickets } = createSubject();
      await tickets.start();
      tickets.stop();

      const response = await tickets.routes.request('/projects/owner/name/board');

      expect(await response.json()).toMatchObject({ runningTicketNumbers: [] });
    });

    it('should serve a ticket under /projects/:owner/:name/tickets/:number when it is in the snapshot', async () => {
      const { tickets } = createSubject();
      await tickets.start();
      tickets.stop();

      const response = await tickets.routes.request('/projects/owner/name/tickets/1');

      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ ticket: { number: 1 } });
    });
  });

  describe('openTickets', () => {
    it('should list every open ticket of the snapshot when the project is watched', async () => {
      const { tickets } = createSubject();

      await tickets.start();
      tickets.stop();

      expect(tickets.openTickets('owner/name').map((ticket) => ticket.number)).toEqual([1, 2]);
    });

    it('should list nothing when the project is unknown', async () => {
      const { tickets } = createSubject();

      await tickets.start();
      tickets.stop();

      expect(tickets.openTickets('other/project')).toEqual([]);
    });
  });

  describe('start', () => {
    it('should take the first snapshot and show every ticket when a repository is registered', async () => {
      const { tickets, snapshotChanges } = createSubject();

      await tickets.start();
      tickets.stop();

      expect(snapshotChanges).toEqual([
        {
          projectId: 'owner/name',
          addedTicketNumbers: [1, 2],
          changedTicketNumbers: [],
          removedTicketNumbers: [],
        },
      ]);
      const projectBoard = await readBoard(tickets, 'owner/name');
      expect(projectBoard?.sync.state).toBe('ok');
      expect(projectBoard?.board?.rows.find((row) => row.key === 'idea')?.tickets).toHaveLength(2);
    });

    it('should poll again after the poll interval without taking a snapshot when nothing changed', async () => {
      const { tickets, issueFeeds, ticketSource } = createSubject();
      await tickets.start();

      await vi.advanceTimersByTimeAsync(pollIntervalMilliseconds);
      tickets.stop();

      expect(issueFeeds.requests).toHaveLength(2);
      expect(ticketSource.snapshotRequests).toHaveLength(1);
    });

    it('should show a label change in its new row within one poll interval', async () => {
      const { tickets, issueFeeds, ticketSource, snapshotChanges } = createSubject();
      await tickets.start();
      issueFeeds.changed = true;
      ticketSource.snapshotToReturn = {
        takenAt: startedAt,
        openTickets: [buildTicket({ number: 1, status: 'ready' }), buildTicket({ number: 2 })],
        recentlyClosedTickets: [],
        closedTotalCount: 0,
      };

      await vi.advanceTimersByTimeAsync(pollIntervalMilliseconds);
      tickets.stop();

      const readyRow = (await readBoard(tickets, 'owner/name'))?.board?.rows.find(
        (row) => row.key === 'ready',
      );
      expect(readyRow?.tickets.map((ticket) => ticket.number)).toEqual([1]);
      expect(snapshotChanges.at(-1)?.changedTicketNumbers).toEqual([1]);
    });

    it('should take a snapshot when the safety-net interval has passed and the feeds are unchanged', async () => {
      const { tickets, clock, ticketSource } = createSubject();
      await tickets.start();
      clock.setNow('2026-09-28T12:05:00.000Z');

      await vi.advanceTimersByTimeAsync(pollIntervalMilliseconds);
      tickets.stop();

      expect(ticketSource.snapshotRequests).toHaveLength(2);
    });

    it('should never overlap polls when a poll takes longer than the poll interval', async () => {
      const { tickets, issueFeeds, ticketSource } = createSubject();
      let finishSnapshot: () => void = () => undefined;
      ticketSource.release = new Promise((resolve) => {
        finishSnapshot = resolve;
      });
      const started = tickets.start();

      await vi.advanceTimersByTimeAsync(pollIntervalMilliseconds * 5);
      expect(issueFeeds.requests).toHaveLength(1);
      finishSnapshot();
      await started;
      tickets.stop();

      expect(issueFeeds.requests).toHaveLength(1);
    });

    it('should show failed/unexpected and keep polling when a poll throws an unknown error', async () => {
      const { tickets, issueFeeds } = createSubject();
      issueFeeds.failure = new TypeError('boom');

      await tickets.start();
      const failedSync = (await readBoard(tickets, 'owner/name'))?.sync;
      issueFeeds.failure = undefined;
      await vi.advanceTimersByTimeAsync(pollIntervalMilliseconds);
      tickets.stop();

      expect(failedSync).toMatchObject({ state: 'failed', cause: 'unexpected', message: 'boom' });
      expect((await readBoard(tickets, 'owner/name'))?.sync.state).toBe('ok');
    });
  });

  describe('project.added', () => {
    it('should poll the new repository at once when a project is added', async () => {
      const { tickets, events, ticketSource } = createSubject();
      await tickets.start();

      events.emit('project.added', {
        projectId: 'owner/other',
        repository: { owner: 'owner', name: 'other' },
        checkoutPath: '/checkout',
      });
      await vi.advanceTimersByTimeAsync(0);
      tickets.stop();

      expect(ticketSource.snapshotRequests.map((request) => request.name)).toEqual([
        'name',
        'other',
      ]);
      expect((await readBoard(tickets, 'owner/other'))?.sync.state).toBe('ok');
    });

    it('should poll once more straight after the running poll when a project is added during it', async () => {
      const { tickets, events, issueFeeds, ticketSource } = createSubject();
      let finishSnapshot: () => void = () => undefined;
      ticketSource.release = new Promise((resolve) => {
        finishSnapshot = resolve;
      });
      const started = tickets.start();

      events.emit('project.added', {
        projectId: 'owner/other',
        repository: { owner: 'owner', name: 'other' },
        checkoutPath: '/checkout',
      });
      await vi.advanceTimersByTimeAsync(pollIntervalMilliseconds * 5);
      expect(issueFeeds.requests).toHaveLength(1);
      finishSnapshot();
      await started;
      const requestCountBeforeIntervalPoll = issueFeeds.requests.length;
      await vi.advanceTimersByTimeAsync(pollIntervalMilliseconds);
      tickets.stop();

      // One feed request per repository: the first poll covers 1, the follow-up poll 2, the interval poll 2.
      expect(requestCountBeforeIntervalPoll).toBe(3);
      expect(issueFeeds.requests).toHaveLength(5);
    });
  });

  describe('board', () => {
    it('should return undefined when the project is not watched', async () => {
      const { tickets } = createSubject();
      await tickets.start();
      tickets.stop();

      expect(await readBoard(tickets, 'owner/unknown')).toBeUndefined();
    });

    it('should return a pending status without a board before the first poll settles', async () => {
      const { tickets, ticketSource } = createSubject();
      ticketSource.release = new Promise(() => undefined);
      void tickets.start();
      await vi.advanceTimersByTimeAsync(0);
      tickets.stop();

      expect(await readBoard(tickets, 'owner/name')).toEqual({
        projectId: 'owner/name',
        sync: { state: 'pending' },
        runningTicketNumbers: [],
      });
    });
  });

  describe('ticket', () => {
    it('should return undefined when the project is not watched', async () => {
      const { tickets } = createSubject();
      await tickets.start();
      tickets.stop();

      expect(await tickets.ticket('owner/unknown', 1)).toBeUndefined();
    });

    it('should serve an open ticket from the snapshot when the project is watched', async () => {
      const { tickets, ticketSource } = createSubject();
      await tickets.start();
      tickets.stop();

      const projectTicket = await tickets.ticket('owner/name', 1);

      expect(projectTicket?.ticket?.number).toBe(1);
      expect(projectTicket?.sync.state).toBe('ok');
      expect(ticketSource.ticketRequests).toHaveLength(0);
    });

    it('should return undefined when the ticket does not exist', async () => {
      const { tickets } = createSubject();
      await tickets.start();
      tickets.stop();

      expect(await tickets.ticket('owner/name', 99)).toBeUndefined();
    });
  });
  describe('status writes', () => {
    const projectId = 'owner/name';

    function snapshotOf(...openTickets: ReturnType<typeof buildTicket>[]) {
      return {
        takenAt: startedAt,
        openTickets,
        recentlyClosedTickets: [],
        closedTotalCount: 0,
      };
    }

    async function startWith(...openTickets: ReturnType<typeof buildTicket>[]) {
      const subject = createSubject();
      subject.ticketSource.snapshotToReturn = snapshotOf(...openTickets);
      await subject.tickets.start();
      return subject;
    }

    function announce(
      events: TypedEventBus<AisfEventMap>,
      from: AisfEventMap['ticket.status-written']['from'],
      to: AisfEventMap['ticket.status-written']['to'],
    ) {
      events.emit('ticket.status-written', { projectId, ticketNumber: 12, from, to });
    }

    async function rowOf(tickets: ReturnType<typeof createSubject>['tickets'], number: number) {
      const rows = (await readBoard(tickets, projectId))?.board?.rows ?? [];
      return rows.find((row) => row.tickets.some((ticket) => ticket.number === number))?.key;
    }

    async function nextPoll(
      subject: Awaited<ReturnType<typeof startWith>>,
      snapshotTicket?: ReturnType<typeof buildTicket>,
    ) {
      if (snapshotTicket !== undefined) {
        subject.ticketSource.snapshotToReturn = snapshotOf(snapshotTicket);
      }
      await vi.advanceTimersByTimeAsync(pollIntervalMilliseconds);
    }

    it('should show the announced status on the ticket read when a write is announced', async () => {
      const subject = await startWith(buildTicket({ number: 12, status: 'in-progress' }));

      announce(subject.events, 'in-progress', 'stuck');
      const projectTicket = await subject.tickets.ticket(projectId, 12);
      subject.tickets.stop();

      expect(projectTicket?.ticket?.status).toBe('stuck');
    });

    it('should poll at once when a write is announced', async () => {
      const subject = await startWith(buildTicket({ number: 12, status: 'in-progress' }));

      announce(subject.events, 'in-progress', 'stuck');
      await vi.advanceTimersByTimeAsync(0);
      subject.tickets.stop();

      expect(subject.issueFeeds.requests).toHaveLength(2);
    });

    it('should show the ticket in its new board row when a write is announced', async () => {
      const subject = await startWith(buildTicket({ number: 12, status: 'stuck' }));

      announce(subject.events, 'stuck', 'in-progress');
      const row = await rowOf(subject.tickets, 12);
      subject.tickets.stop();

      expect(row).toBe('in-progress');
    });

    it('should hide a mid-swap conflict read when a write is unconfirmed', async () => {
      const subject = await startWith(buildTicket({ number: 12, status: 'stuck' }));
      announce(subject.events, 'stuck', 'in-progress');
      subject.issueFeeds.changed = true;

      await nextPoll(
        subject,
        buildTicket({
          number: 12,
          status: 'conflict',
          conflictingStatuses: ['stuck', 'in-progress'],
        }),
      );
      const projectTicket = await subject.tickets.ticket(projectId, 12);
      const row = await rowOf(subject.tickets, 12);
      subject.tickets.stop();

      expect(projectTicket?.ticket).toMatchObject({
        status: 'in-progress',
        conflictingStatuses: [],
      });
      expect(row).toBe('in-progress');
    });

    it('should hide a mid-swap idea read when a write is unconfirmed', async () => {
      const subject = await startWith(buildTicket({ number: 12, status: 'stuck' }));
      announce(subject.events, 'stuck', 'in-progress');
      subject.issueFeeds.changed = true;

      await nextPoll(subject, buildTicket({ number: 12, status: 'idea' }));
      const row = await rowOf(subject.tickets, 12);
      subject.tickets.stop();

      expect(row).toBe('in-progress');
    });

    it('should show the announced status in openTickets when a write is unconfirmed', async () => {
      const subject = await startWith(buildTicket({ number: 12, status: 'in-progress' }));

      announce(subject.events, 'in-progress', 'stuck');
      subject.tickets.stop();

      expect(subject.tickets.openTickets(projectId)[0]?.status).toBe('stuck');
    });

    it('should keep the write and snapshot again when the snapshot still shows the old status', async () => {
      const subject = await startWith(buildTicket({ number: 12, status: 'in-progress' }));
      announce(subject.events, 'in-progress', 'stuck');
      subject.clock.setNow('2026-09-28T12:00:10.000Z');
      subject.issueFeeds.changed = true;

      await vi.advanceTimersByTimeAsync(0);
      subject.issueFeeds.changed = false;
      await nextPoll(subject);
      subject.tickets.stop();

      expect((await subject.tickets.ticket(projectId, 12))?.ticket?.status).toBe('stuck');
      expect(subject.ticketSource.snapshotRequests).toHaveLength(3);
    });

    it('should drop the write and skip the snapshot when the snapshot confirms it', async () => {
      const subject = await startWith(buildTicket({ number: 12, status: 'in-progress' }));
      announce(subject.events, 'in-progress', 'stuck');
      subject.ticketSource.snapshotToReturn = snapshotOf(
        buildTicket({ number: 12, status: 'stuck' }),
      );
      await vi.advanceTimersByTimeAsync(0);
      const snapshotsAfterConfirmation = subject.ticketSource.snapshotRequests.length;

      await nextPoll(subject);
      subject.tickets.stop();

      expect(subject.ticketSource.snapshotRequests).toHaveLength(snapshotsAfterConfirmation);
    });

    it('should show the snapshot status when the write is 60 s old', async () => {
      const subject = await startWith(buildTicket({ number: 12, status: 'in-progress' }));
      announce(subject.events, 'in-progress', 'stuck');
      subject.clock.setNow('2026-09-28T12:01:00.000Z');

      await vi.advanceTimersByTimeAsync(0);
      subject.tickets.stop();

      expect((await subject.tickets.ticket(projectId, 12))?.ticket?.status).toBe('in-progress');
    });

    it('should drop an overtaken write when the snapshot shows another status', async () => {
      const subject = await startWith(buildTicket({ number: 12, status: 'stuck' }));
      announce(subject.events, 'stuck', 'in-progress');
      subject.ticketSource.snapshotToReturn = snapshotOf(
        buildTicket({ number: 12, status: 'ready' }),
      );
      await vi.advanceTimersByTimeAsync(0);
      const readyStatus = (await subject.tickets.ticket(projectId, 12))?.ticket?.status;
      subject.ticketSource.snapshotToReturn = snapshotOf(
        buildTicket({ number: 12, status: 'stuck' }),
      );
      subject.issueFeeds.changed = true;
      await nextPoll(subject);
      subject.tickets.stop();

      expect(readyStatus).toBe('ready');
      expect((await subject.tickets.ticket(projectId, 12))?.ticket?.status).toBe('stuck');
    });

    it('should drop the write when the ticket is no longer open', async () => {
      const subject = await startWith(buildTicket({ number: 12, status: 'in-progress' }));
      announce(subject.events, 'in-progress', 'stuck');
      subject.ticketSource.snapshotToReturn = snapshotOf(buildTicket({ number: 13 }));
      await vi.advanceTimersByTimeAsync(0);
      subject.ticketSource.snapshotToReturn = snapshotOf(
        buildTicket({ number: 12, status: 'in-progress' }),
      );
      subject.issueFeeds.changed = true;
      await nextPoll(subject);
      subject.tickets.stop();

      expect((await subject.tickets.ticket(projectId, 12))?.ticket?.status).toBe('in-progress');
    });

    it('should let a newer write replace the older one when both concern the same ticket', async () => {
      const subject = await startWith(buildTicket({ number: 12, status: 'stuck' }));
      announce(subject.events, 'stuck', 'in-progress');
      announce(subject.events, 'in-progress', 'stuck');
      const status = (await subject.tickets.ticket(projectId, 12))?.ticket?.status;
      await vi.advanceTimersByTimeAsync(0);
      const snapshotsAfterConfirmation = subject.ticketSource.snapshotRequests.length;
      await nextPoll(subject);
      subject.tickets.stop();

      expect(status).toBe('stuck');
      expect(subject.ticketSource.snapshotRequests).toHaveLength(snapshotsAfterConfirmation);
    });

    it('should keep a write recorded during an in-flight poll and poll once more', async () => {
      const subject = createSubject();
      subject.ticketSource.snapshotToReturn = snapshotOf(
        buildTicket({ number: 12, status: 'in-progress' }),
      );
      let finishSnapshot: () => void = () => undefined;
      subject.ticketSource.release = new Promise((resolve) => {
        finishSnapshot = resolve;
      });
      const started = subject.tickets.start();
      await vi.advanceTimersByTimeAsync(0);

      announce(subject.events, 'in-progress', 'stuck');
      finishSnapshot();
      await started;
      subject.tickets.stop();

      expect((await subject.tickets.ticket(projectId, 12))?.ticket?.status).toBe('stuck');
      expect(subject.issueFeeds.requests).toHaveLength(2);
    });

    it('should take a fresh snapshot when a write is unconfirmed and the feeds are unchanged', async () => {
      const subject = await startWith(buildTicket({ number: 12, status: 'in-progress' }));
      announce(subject.events, 'in-progress', 'stuck');

      await vi.advanceTimersByTimeAsync(0);
      subject.tickets.stop();

      expect(subject.issueFeeds.changed).toBe(false);
      expect(subject.ticketSource.snapshotRequests).toHaveLength(2);
    });

    it('should leave a ticket alone when its status is neither from nor mid-swap', async () => {
      const subject = await startWith(buildTicket({ number: 12, status: 'planned' }));

      announce(subject.events, 'in-progress', 'stuck');
      subject.tickets.stop();

      expect((await subject.tickets.ticket(projectId, 12))?.ticket?.status).toBe('planned');
    });

    it('should report the real snapshot time when a write is shown', async () => {
      const subject = await startWith(buildTicket({ number: 12, status: 'in-progress' }));
      subject.clock.setNow('2026-09-28T12:00:05.000Z');

      announce(subject.events, 'in-progress', 'stuck');
      subject.tickets.stop();

      expect((await subject.tickets.ticket(projectId, 12))?.sync).toMatchObject({
        snapshotTakenAt: startedAt,
      });
    });

    it('should emit snapshot.changed from raw snapshots when the written status arrives', async () => {
      const subject = await startWith(buildTicket({ number: 12, status: 'in-progress' }));
      announce(subject.events, 'in-progress', 'stuck');
      subject.snapshotChanges.length = 0;
      subject.ticketSource.snapshotToReturn = snapshotOf(
        buildTicket({ number: 12, status: 'stuck' }),
      );

      await vi.advanceTimersByTimeAsync(0);
      subject.tickets.stop();

      expect(subject.snapshotChanges.map((change) => change.changedTicketNumbers)).toEqual([[12]]);
    });

    it('should poll at once when a run finishes', async () => {
      const subject = await startWith(buildTicket({ number: 12 }));

      subject.events.emit('run.finished', {
        runId: 'run-1',
        projectId,
        ticketNumber: 12,
        ending: { kind: 'parked', blockerNumber: 1 },
      });
      await vi.advanceTimersByTimeAsync(0);
      subject.tickets.stop();

      expect(subject.issueFeeds.requests).toHaveLength(2);
    });

    it('should record no write and request no poll when the module is stopped', async () => {
      const subject = await startWith(buildTicket({ number: 12, status: 'in-progress' }));
      subject.tickets.stop();

      announce(subject.events, 'in-progress', 'stuck');
      subject.events.emit('run.finished', {
        runId: 'run-1',
        projectId,
        ticketNumber: 12,
        ending: { kind: 'parked', blockerNumber: 1 },
      });
      await vi.advanceTimersByTimeAsync(0);

      expect(subject.tickets.openTickets(projectId)[0]?.status).toBe('in-progress');
      expect(subject.issueFeeds.requests).toHaveLength(1);
    });
  });
});
