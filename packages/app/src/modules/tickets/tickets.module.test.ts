import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DomainEvents } from '../../shared/event-bus.js';
import type { Jobs } from '../../shared/jobs.js';
import { InMemoryEventBus } from '../../shared/in-memory-event-bus.js';
import { FakeClock } from '../../shared/testing/fake-clock.js';
import { InMemoryWatchStore } from './infrastructure/repository/in-memory-watch-store.js';
import { createTicketsModule } from './index.js';
import { buildTicket } from './testing/build-ticket.js';
import { FakeRunSettlement, FakeTicketStatusWrites } from './testing/fake-ticket-status-writes.js';
import {
  FakeIdeaCreation,
  FakeIssueFeeds,
  FakeTicketSource,
} from './testing/fake-tickets-ports.js';

const startedAt = '2026-09-28T12:00:00.000Z';
const pollIntervalMilliseconds = 30_000;
const snapshotIntervalMilliseconds = 300_000;
const registered = { projectId: 'owner/name', repository: { owner: 'owner', name: 'name' } };

function runJob(jobs: Jobs, name: string): Promise<void> {
  const job = jobs[name];
  if (job === undefined) {
    throw new Error(`Unknown job: ${name}`);
  }
  return job();
}

function createSubject(runningTicketNumbers: ReadonlyArray<number> = []) {
  const events = new InMemoryEventBus<DomainEvents>();
  const issueFeeds = new FakeIssueFeeds();
  const ticketSource = new FakeTicketSource({
    takenAt: startedAt,
    openTickets: [buildTicket({ number: 1 }), buildTicket({ number: 2 })],
    recentlyClosedTickets: [],
    closedTotalCount: 0,
  });
  const ideaCreation = new FakeIdeaCreation();
  const clock = new FakeClock(startedAt);
  const ticketStatusWrites = new FakeTicketStatusWrites();
  const runSettlement = new FakeRunSettlement();
  const snapshotChanges: Array<DomainEvents['snapshot.changed']> = [];
  events.on('snapshot.changed', (payload) => snapshotChanges.push(payload));
  const module = createTicketsModule(
    {
      clock,
      events,
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      pollIntervalMilliseconds,
      snapshotIntervalMilliseconds,
      projects: {
        list: async () => [
          {
            id: registered.projectId,
            repository: registered.repository,
            checkoutPath: '/checkout',
            addedAt: startedAt,
            contract: { passed: true, missingSlots: [], missingKeys: [] },
          },
        ],
      },
      runner: {
        activeRuns: async () =>
          runningTicketNumbers.map(
            (ticketNumber) => ({ run: { ticketNumber }, steps: [] }) as never,
          ),
        activeWaits: async () => [],
        settle: (runId) => runSettlement.settle(runId),
      },
    },
    {
      issueFeeds,
      ticketSource,
      ideaCreation,
      ticketStatusWrites,
      watchStore: new InMemoryWatchStore(),
    },
  );
  const tickets = {
    routes: module.routes,
    start: () => runJob(module.jobs, 'tickets.watch-repositories'),
    stop: () => {
      void runJob(module.jobs, 'tickets.stop-watching');
    },
    openTickets: (projectId: string) => module.internal.openTickets(projectId),
    ticket: (projectId: string, number: number) => module.internal.ticket(projectId, number),
    beginAnswer: (projectId: string, ticketNumber: number) =>
      module.internal.beginAnswer(projectId, ticketNumber),
    revertAnswer: (projectId: string, ticketNumber: number) =>
      module.internal.revertAnswer(projectId, ticketNumber),
    createIdea: (
      repository: { owner: string; name: string },
      idea: { title: string; body: string },
    ) => module.internal.createIdea(repository, idea),
  };
  return {
    tickets,
    events,
    issueFeeds,
    ticketSource,
    ideaCreation,
    clock,
    snapshotChanges,
    ticketStatusWrites,
    runSettlement,
  };
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
  const response = await tickets.routes.request(`/api/projects/${projectId}/board`);
  return response.status === 404 ? undefined : ((await response.json()) as BoardBody);
}

describe('createTicketsModule', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('ticket writes', () => {
    it('should reset a stuck ticket to ready and answer 204 when the reset is posted', async () => {
      const { tickets, ticketStatusWrites } = createSubject();
      ticketStatusWrites.liveStuck = true;

      const response = await tickets.routes.request('/api/projects/owner/name/tickets/5/reset', {
        method: 'POST',
      });

      expect(response.status).toBe(204);
      expect(ticketStatusWrites.calls).toContain('setStatus #5 -> ready');
    });

    it('should answer 409 and write nothing when the reset is posted for a ticket with an active run', async () => {
      const { tickets, ticketStatusWrites } = createSubject([5]);
      ticketStatusWrites.liveStuck = true;

      const response = await tickets.routes.request('/api/projects/owner/name/tickets/5/reset', {
        method: 'POST',
      });

      expect(response.status).toBe(409);
      expect(ticketStatusWrites.calls).toEqual([]);
    });

    it('should add the waiting label with the comment when run.waiting is emitted after start', async () => {
      const { tickets, events, ticketStatusWrites, runSettlement } = createSubject();
      await tickets.start();

      events.emit('run.waiting', {
        runId: 'r1',
        projectId: 'owner/name',
        ticketNumber: 5,
        stage: 'implement',
        wait: { kind: 'checkpoint', request: 'Pick A or B' },
      });

      await vi.waitFor(() =>
        expect(ticketStatusWrites.calls).toContain('setSecondaryState #5 waiting on'),
      );
      expect(ticketStatusWrites.calls.some((call) => call.startsWith('comment #5'))).toBe(true);
      expect(runSettlement.calls).toEqual([]);
      tickets.stop();
    });

    it('should add the stuck label, announce it, then settle the run when run.finished ends crashed', async () => {
      const { tickets, events, ticketStatusWrites, runSettlement } = createSubject();
      const written: Array<DomainEvents['ticket.status-written']> = [];
      events.on('ticket.status-written', (payload) => written.push(payload));
      await tickets.start();

      events.emit('run.finished', {
        runId: 'r1',
        projectId: 'owner/name',
        ticketNumber: 5,
        stage: 'implement',
        ending: { kind: 'crashed', reason: 'boom' },
      });

      await vi.waitFor(() => expect(runSettlement.calls).toEqual(['settle r1']));
      expect(ticketStatusWrites.calls).toContain('setSecondaryState #5 stuck on');
      expect(written).toContainEqual({
        projectId: 'owner/name',
        ticketNumber: 5,
        from: 'in-progress',
        to: 'in-progress',
        waiting: false,
        stuck: true,
      });
      tickets.stop();
    });

    it('should settle a finished run when run.finished is emitted before the watch job runs', async () => {
      const { events, runSettlement } = createSubject();

      events.emit('run.finished', {
        runId: 'r1',
        projectId: 'owner/name',
        ticketNumber: 5,
        stage: 'implement',
        ending: { kind: 'stopped' },
      });

      await vi.waitFor(() => expect(runSettlement.calls).toEqual(['settle r1']));
    });

    it('should stop settling finished runs when the stop-watching job has run', async () => {
      const { tickets, events, runSettlement } = createSubject();
      await tickets.start();
      tickets.stop();

      events.emit('run.finished', {
        runId: 'r1',
        projectId: 'owner/name',
        ticketNumber: 5,
        stage: 'implement',
        ending: { kind: 'stopped' },
      });
      await Promise.resolve();

      expect(runSettlement.calls).toEqual([]);
    });

    it('should refuse beginAnswer and write nothing when the ticket has no waiting label', async () => {
      const { tickets, ticketStatusWrites } = createSubject();

      await expect(tickets.beginAnswer('owner/name', 5)).rejects.toThrow('#5 is not waiting');

      expect(ticketStatusWrites.calls).toEqual(['readState']);
    });

    it('should remove the waiting label on beginAnswer and restore it on revertAnswer when the ticket waits', async () => {
      const { tickets, ticketStatusWrites } = createSubject();
      ticketStatusWrites.liveWaiting = true;

      await tickets.beginAnswer('owner/name', 5);
      await tickets.revertAnswer('owner/name', 5);

      expect(ticketStatusWrites.calls).toEqual([
        'readState',
        'setSecondaryState #5 waiting off',
        'readState',
        'setSecondaryState #5 waiting on',
      ]);
    });
  });

  describe('routes', () => {
    it('should serve the board under /projects/:owner/:name/board when the project is watched', async () => {
      const { tickets } = createSubject();
      await tickets.start();
      tickets.stop();

      const response = await tickets.routes.request('/api/projects/owner/name/board');

      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ projectId: 'owner/name' });
    });

    it('should name the running tickets on the board when the project has active runs', async () => {
      const { tickets } = createSubject([139, 140]);
      await tickets.start();
      tickets.stop();

      const response = await tickets.routes.request('/api/projects/owner/name/board');

      expect(await response.json()).toMatchObject({ runningTicketNumbers: [139, 140] });
    });

    it('should name no running tickets on the board when the project has no active run', async () => {
      const { tickets } = createSubject();
      await tickets.start();
      tickets.stop();

      const response = await tickets.routes.request('/api/projects/owner/name/board');

      expect(await response.json()).toMatchObject({ runningTicketNumbers: [] });
    });

    it('should serve a ticket under /projects/:owner/:name/tickets/:number when it is in the snapshot', async () => {
      const { tickets } = createSubject();
      await tickets.start();
      tickets.stop();

      const response = await tickets.routes.request('/api/projects/owner/name/tickets/1');

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

  describe('createIdea', () => {
    const idea = { title: 'Export trips', body: '' };

    it('should hand the title and body to idea creation and return the new number when the repository is watched', async () => {
      const { tickets, ideaCreation } = createSubject();
      await tickets.start();

      const number = await tickets.createIdea(registered.repository, idea);
      tickets.stop();

      expect(number).toBe(12);
      expect(ideaCreation.created).toEqual([{ repository: registered.repository, idea }]);
    });

    it('should show the new idea at once when the last snapshot is fresh and the feeds are unchanged', async () => {
      const { tickets, ideaCreation, ticketSource } = createSubject();
      await tickets.start();
      ideaCreation.onCreate = () => {
        ticketSource.snapshotToReturn = {
          ...ticketSource.snapshotToReturn,
          openTickets: [
            ...ticketSource.snapshotToReturn.openTickets,
            buildTicket({ number: 12, title: 'Export trips' }),
          ],
        };
      };

      await tickets.createIdea(registered.repository, idea);
      tickets.stop();

      expect(await tickets.ticket('owner/name', 12)).toMatchObject({ ticket: { number: 12 } });
    });

    it('should return the number when the fresh snapshot fails', async () => {
      const { tickets, ticketSource } = createSubject();
      await tickets.start();
      ticketSource.failure = new Error('github down');

      const number = await tickets.createIdea(registered.repository, idea);
      tickets.stop();

      expect(number).toBe(12);
    });

    it('should show the idea after the next timer poll when the fresh snapshot failed', async () => {
      const { tickets, ideaCreation, ticketSource } = createSubject();
      await tickets.start();
      ticketSource.failure = new Error('github down');
      ideaCreation.onCreate = () => {
        ticketSource.snapshotToReturn = {
          ...ticketSource.snapshotToReturn,
          openTickets: [buildTicket({ number: 12 })],
        };
      };
      await tickets.createIdea(registered.repository, idea);
      ticketSource.failure = undefined;

      await vi.advanceTimersByTimeAsync(pollIntervalMilliseconds);
      tickets.stop();

      expect(tickets.openTickets('owner/name').map(({ number }) => number)).toEqual([12]);
    });

    it('should snapshot once more after the running poll when a poll is in flight', async () => {
      const { tickets, ticketSource } = createSubject();
      let finishSnapshot: () => void = () => undefined;
      ticketSource.release = new Promise((resolve) => {
        finishSnapshot = resolve;
      });
      const started = tickets.start();
      await vi.advanceTimersByTimeAsync(0);

      const created = tickets.createIdea(registered.repository, idea);
      await vi.advanceTimersByTimeAsync(0);
      const snapshotsWhileRunning = ticketSource.snapshotRequests.length;
      finishSnapshot();
      await Promise.all([started, created]);
      tickets.stop();

      expect(snapshotsWhileRunning).toBe(1);
      expect(ticketSource.snapshotRequests).toHaveLength(2);
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
      events: InMemoryEventBus<DomainEvents>,
      from: DomainEvents['ticket.status-written']['from'],
      to: DomainEvents['ticket.status-written']['to'],
    ) {
      events.emit('ticket.status-written', {
        projectId,
        ticketNumber: 12,
        from,
        to,
        waiting: false,
        stuck: false,
      });
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

      announce(subject.events, 'in-progress', 'in-review');
      const projectTicket = await subject.tickets.ticket(projectId, 12);
      subject.tickets.stop();

      expect(projectTicket?.ticket?.status).toBe('in-review');
    });

    it('should poll at once when a write is announced', async () => {
      const subject = await startWith(buildTicket({ number: 12, status: 'in-progress' }));

      announce(subject.events, 'in-progress', 'in-review');
      await vi.advanceTimersByTimeAsync(0);
      subject.tickets.stop();

      expect(subject.issueFeeds.requests).toHaveLength(2);
    });

    it('should show the ticket in its new board row when a write is announced', async () => {
      const subject = await startWith(buildTicket({ number: 12, status: 'in-review' }));

      announce(subject.events, 'in-review', 'in-progress');
      const row = await rowOf(subject.tickets, 12);
      subject.tickets.stop();

      expect(row).toBe('in-progress');
    });

    it('should hide a mid-swap conflict read when a write is unconfirmed', async () => {
      const subject = await startWith(buildTicket({ number: 12, status: 'in-review' }));
      announce(subject.events, 'in-review', 'in-progress');
      subject.issueFeeds.changed = true;

      await nextPoll(
        subject,
        buildTicket({
          number: 12,
          status: 'conflict',
          conflictingStatuses: ['in-review', 'in-progress'],
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
      const subject = await startWith(buildTicket({ number: 12, status: 'in-review' }));
      announce(subject.events, 'in-review', 'in-progress');
      subject.issueFeeds.changed = true;

      await nextPoll(subject, buildTicket({ number: 12, status: 'idea' }));
      const row = await rowOf(subject.tickets, 12);
      subject.tickets.stop();

      expect(row).toBe('in-progress');
    });

    it('should show the announced status in openTickets when a write is unconfirmed', async () => {
      const subject = await startWith(buildTicket({ number: 12, status: 'in-progress' }));

      announce(subject.events, 'in-progress', 'in-review');
      subject.tickets.stop();

      expect(subject.tickets.openTickets(projectId)[0]?.status).toBe('in-review');
    });

    it('should keep the write and snapshot again when the snapshot still shows the old status', async () => {
      const subject = await startWith(buildTicket({ number: 12, status: 'in-progress' }));
      announce(subject.events, 'in-progress', 'in-review');
      subject.clock.setNow('2026-09-28T12:00:10.000Z');
      subject.issueFeeds.changed = true;

      await vi.advanceTimersByTimeAsync(0);
      subject.issueFeeds.changed = false;
      await nextPoll(subject);
      subject.tickets.stop();

      expect((await subject.tickets.ticket(projectId, 12))?.ticket?.status).toBe('in-review');
      expect(subject.ticketSource.snapshotRequests).toHaveLength(3);
    });

    it('should drop the write and skip the snapshot when the snapshot confirms it', async () => {
      const subject = await startWith(buildTicket({ number: 12, status: 'in-progress' }));
      announce(subject.events, 'in-progress', 'in-review');
      subject.ticketSource.snapshotToReturn = snapshotOf(
        buildTicket({ number: 12, status: 'in-review' }),
      );
      await vi.advanceTimersByTimeAsync(0);
      const snapshotsAfterConfirmation = subject.ticketSource.snapshotRequests.length;

      await nextPoll(subject);
      subject.tickets.stop();

      expect(subject.ticketSource.snapshotRequests).toHaveLength(snapshotsAfterConfirmation);
    });

    it('should show the snapshot status when the write is 60 s old', async () => {
      const subject = await startWith(buildTicket({ number: 12, status: 'in-progress' }));
      announce(subject.events, 'in-progress', 'in-review');
      subject.clock.setNow('2026-09-28T12:01:00.000Z');

      await vi.advanceTimersByTimeAsync(0);
      subject.tickets.stop();

      expect((await subject.tickets.ticket(projectId, 12))?.ticket?.status).toBe('in-progress');
    });

    it('should drop an overtaken write when the snapshot shows another status', async () => {
      const subject = await startWith(buildTicket({ number: 12, status: 'in-review' }));
      announce(subject.events, 'in-review', 'in-progress');
      subject.ticketSource.snapshotToReturn = snapshotOf(
        buildTicket({ number: 12, status: 'ready' }),
      );
      await vi.advanceTimersByTimeAsync(0);
      const readyStatus = (await subject.tickets.ticket(projectId, 12))?.ticket?.status;
      subject.ticketSource.snapshotToReturn = snapshotOf(
        buildTicket({ number: 12, status: 'in-review' }),
      );
      subject.issueFeeds.changed = true;
      await nextPoll(subject);
      subject.tickets.stop();

      expect(readyStatus).toBe('ready');
      expect((await subject.tickets.ticket(projectId, 12))?.ticket?.status).toBe('in-review');
    });

    it('should drop the write when the ticket is no longer open', async () => {
      const subject = await startWith(buildTicket({ number: 12, status: 'in-progress' }));
      announce(subject.events, 'in-progress', 'in-review');
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
      const subject = await startWith(buildTicket({ number: 12, status: 'in-review' }));
      announce(subject.events, 'in-review', 'in-progress');
      announce(subject.events, 'in-progress', 'in-review');
      const status = (await subject.tickets.ticket(projectId, 12))?.ticket?.status;
      await vi.advanceTimersByTimeAsync(0);
      const snapshotsAfterConfirmation = subject.ticketSource.snapshotRequests.length;
      await nextPoll(subject);
      subject.tickets.stop();

      expect(status).toBe('in-review');
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

      announce(subject.events, 'in-progress', 'in-review');
      finishSnapshot();
      await started;
      subject.tickets.stop();

      expect((await subject.tickets.ticket(projectId, 12))?.ticket?.status).toBe('in-review');
      expect(subject.issueFeeds.requests).toHaveLength(2);
    });

    it('should take a fresh snapshot when a write is unconfirmed and the feeds are unchanged', async () => {
      const subject = await startWith(buildTicket({ number: 12, status: 'in-progress' }));
      announce(subject.events, 'in-progress', 'in-review');

      await vi.advanceTimersByTimeAsync(0);
      subject.tickets.stop();

      expect(subject.issueFeeds.changed).toBe(false);
      expect(subject.ticketSource.snapshotRequests).toHaveLength(2);
    });

    it('should leave a ticket alone when its status is neither from nor mid-swap', async () => {
      const subject = await startWith(buildTicket({ number: 12, status: 'planned' }));

      announce(subject.events, 'in-progress', 'in-review');
      subject.tickets.stop();

      expect((await subject.tickets.ticket(projectId, 12))?.ticket?.status).toBe('planned');
    });

    it('should report the real snapshot time when a write is shown', async () => {
      const subject = await startWith(buildTicket({ number: 12, status: 'in-progress' }));
      subject.clock.setNow('2026-09-28T12:00:05.000Z');

      announce(subject.events, 'in-progress', 'in-review');
      subject.tickets.stop();

      expect((await subject.tickets.ticket(projectId, 12))?.sync).toMatchObject({
        snapshotTakenAt: startedAt,
      });
    });

    it('should emit snapshot.changed from raw snapshots when the written status arrives', async () => {
      const subject = await startWith(buildTicket({ number: 12, status: 'in-progress' }));
      announce(subject.events, 'in-progress', 'in-review');
      subject.snapshotChanges.length = 0;
      subject.ticketSource.snapshotToReturn = snapshotOf(
        buildTicket({ number: 12, status: 'in-review' }),
      );

      await vi.advanceTimersByTimeAsync(0);
      subject.tickets.stop();

      expect(subject.snapshotChanges.map((change) => change.changedTicketNumbers)).toEqual([[12]]);
    });

    it('should poll at once when a run finishes', async () => {
      const subject = await startWith(buildTicket({ number: 12 }));
      // The ticket already left the run's statuses, so settling the run writes nothing.
      subject.ticketStatusWrites.liveStatus = 'in-review';

      subject.events.emit('run.finished', {
        runId: 'run-1',
        projectId,
        ticketNumber: 12,
        stage: 'implement',
        ending: { kind: 'parked', blockerNumber: 1 },
      });
      await vi.advanceTimersByTimeAsync(0);
      subject.tickets.stop();

      expect(subject.issueFeeds.requests).toHaveLength(2);
    });

    it('should record no write and request no poll when the module is stopped', async () => {
      const subject = await startWith(buildTicket({ number: 12, status: 'in-progress' }));
      subject.tickets.stop();

      announce(subject.events, 'in-progress', 'in-review');
      subject.events.emit('run.finished', {
        runId: 'run-1',
        projectId,
        ticketNumber: 12,
        stage: 'implement',
        ending: { kind: 'parked', blockerNumber: 1 },
      });
      await vi.advanceTimersByTimeAsync(0);

      expect(subject.tickets.openTickets(projectId)[0]?.status).toBe('in-progress');
      expect(subject.issueFeeds.requests).toHaveLength(1);
    });
  });
});
