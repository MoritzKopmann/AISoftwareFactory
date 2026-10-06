import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createSchedulerModule,
  RunAlreadyActiveError,
  type SchedulerModule,
} from '../../../src/modules/scheduler/index.js';
import type { ReviewedTicket } from '../../../src/modules/scheduler/logic/domain/types/reviewed-ticket.js';
import type { AisfEventMap } from '../../../src/shared/bus/aisf-event-map.js';
import { TypedEventBus } from '../../../src/shared/bus/typed-event-bus.js';
import {
  FakeProjectLookup,
  FakePullRequestMerges,
  FakeReviewedTicketLookup,
  FakeRunnerPort,
  FakeRunsGate,
  FakeTicketLookup,
  FakeTicketStatusWrites,
  readyLeaf,
} from './fakes/fake-scheduler-ports.js';

const approvedTicket: ReviewedTicket = {
  number: 140,
  status: 'in-review',
  closingPullRequests: [
    {
      number: 201,
      state: 'OPEN',
      approved: true,
      checks: 'passing',
      mergeable: 'mergeable',
      canBeRebased: true,
      headCommit: 'abc123',
    },
  ],
};

describe('createSchedulerModule', () => {
  let bus: TypedEventBus<AisfEventMap>;
  let pullRequestMerges: FakePullRequestMerges;
  let runner: FakeRunnerPort;
  let ticketStatusWrites: FakeTicketStatusWrites;
  let scheduler: SchedulerModule;

  beforeEach(() => {
    bus = new TypedEventBus<AisfEventMap>();
    pullRequestMerges = new FakePullRequestMerges();
    runner = new FakeRunnerPort();
    ticketStatusWrites = new FakeTicketStatusWrites();
    scheduler = createSchedulerModule({
      ticketStatusWrites,
      pullRequestMerges,
      runner,
      ticketLookup: new FakeTicketLookup(readyLeaf),
      reviewedTicketLookup: new FakeReviewedTicketLookup([approvedTicket]),
      runsGate: new FakeRunsGate(),
      projectLookup: new FakeProjectLookup(),
      events: bus,
      subscriber: bus,
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    });
  });

  it('should reset a stuck ticket to ready and answer 204 when the reset is posted', async () => {
    ticketStatusWrites.liveStatus = 'stuck';

    const response = await scheduler.routes.request('/projects/moritz/aisf/tickets/138/reset', {
      method: 'POST',
    });

    expect(response.status).toBe(204);
    expect(ticketStatusWrites.calls).toContain('setStatus #138 -> ready');
  });

  it('should report a ready leaf as available when its run is read', async () => {
    const response = await scheduler.routes.request('/projects/moritz/aisf/tickets/138/run');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ availability: { kind: 'available' } });
  });

  it('should report the active run of the ticket when its run is read', async () => {
    runner.activeTicketNumbers = [138];

    const response = await scheduler.routes.request('/projects/moritz/aisf/tickets/138/run');

    expect(await response.json()).toEqual({
      availability: { kind: 'disabled', reason: '#138 is running' },
      activeRun: { id: 'run-1', startedAt: '2026-09-29T09:00:00.000Z', steps: [] },
    });
  });

  it('should start the run on the runner and answer 201 when an available ticket is posted', async () => {
    const response = await scheduler.routes.request('/projects/moritz/aisf/tickets/138/runs', {
      method: 'POST',
    });

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ id: 'run-1', startedAt: '2026-09-29T09:00:00.000Z' });
    expect(runner.calls).toEqual(['start moritz/aisf #138']);
  });

  it('should answer 409 when an available ticket is posted while it already has a run active', async () => {
    runner.activeTicketNumbers = [138];

    const response = await scheduler.routes.request('/projects/moritz/aisf/tickets/138/runs', {
      method: 'POST',
    });

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ message: '#138 is running' });
  });

  it('should answer 409 when the runner reports a run already active', async () => {
    runner.startFailure = new RunAlreadyActiveError('A run is already active');

    const response = await scheduler.routes.request('/projects/moritz/aisf/tickets/138/runs', {
      method: 'POST',
    });

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ message: 'A run is already active' });
  });

  it('should answer a live-waiting run through scheduler.answer like the checkpoint route', async () => {
    runner.record = {
      id: 'r1',
      projectId: 'moritz/aisf',
      ticketNumber: 7,
      startedAt: '2026-09-29T09:00:00.000Z',
      waitingFor: { kind: 'checkpoint', request: 'Pick A or B' },
    };
    runner.latest = { id: 'r1', startedAt: '2026-09-29T09:00:00.000Z' };
    ticketStatusWrites.liveStatus = 'waiting';

    const started = await scheduler.answer('r1', { kind: 'checkpoint', text: 'A' });

    expect(started).toEqual({ id: 'run-2', startedAt: '2026-09-29T11:00:00.000Z' });
    expect(ticketStatusWrites.calls).toContain('setStatus #7 -> in-progress');
    expect(runner.calls).toContain(
      `answer r1 ${JSON.stringify({ kind: 'checkpoint', text: 'A' })}`,
    );
  });

  it('should mark the ticket waiting when run.waiting is emitted after start', async () => {
    scheduler.start();

    bus.emit('run.waiting', {
      runId: 'r1',
      projectId: 'moritz/aisf',
      ticketNumber: 7,
      wait: { kind: 'checkpoint', request: 'Pick A or B' },
    });

    await vi.waitFor(() => expect(ticketStatusWrites.calls).toContain('setStatus #7 -> waiting'));
    expect(runner.calls).not.toContain('settle r1');
  });

  describe('POST /runs/:runId/permission', () => {
    function answerWith(ticketStatusWrites: FakeTicketStatusWrites): SchedulerModule {
      runner.record = {
        id: 'run-1',
        projectId: 'moritz/aisf',
        ticketNumber: 147,
        startedAt: '2026-09-29T09:00:00.000Z',
        endedAt: '2026-09-29T09:30:00.000Z',
        ending: { kind: 'permission-needed', toolName: 'Bash', toolInput: { command: 'ls' } },
      };
      runner.latest = {
        id: 'run-1',
        startedAt: '2026-09-29T09:00:00.000Z',
        ...(runner.record.endedAt === undefined ? {} : { endedAt: runner.record.endedAt }),
        ...(runner.record.ending === undefined ? {} : { ending: runner.record.ending }),
      };
      return createSchedulerModule({
        ticketStatusWrites,
        pullRequestMerges,
        runner,
        ticketLookup: new FakeTicketLookup(readyLeaf),
        reviewedTicketLookup: new FakeReviewedTicketLookup([]),
        runsGate: new FakeRunsGate(),
        projectLookup: new FakeProjectLookup(),
        events: bus,
        subscriber: bus,
        logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      });
    }

    function postAnswer(module: SchedulerModule): Promise<Response> {
      return Promise.resolve(
        module.routes.request('/runs/run-1/permission', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ decision: 'allow' }),
        }),
      );
    }

    it('should set the ticket in-progress, resume the run and answer 201 when the ticket is stuck', async () => {
      const ticketStatusWrites = new FakeTicketStatusWrites();
      ticketStatusWrites.liveStatus = 'stuck';

      const response = await postAnswer(answerWith(ticketStatusWrites));

      expect(response.status).toBe(201);
      expect(ticketStatusWrites.liveStatus).toBe('in-progress');
      expect(runner.calls).toContain(
        `answer run-1 ${JSON.stringify({ kind: 'permission', decision: 'allow' })}`,
      );
    });

    it('should answer 409 and resume nothing when the ticket is not stuck', async () => {
      const ticketStatusWrites = new FakeTicketStatusWrites();

      const response = await postAnswer(answerWith(ticketStatusWrites));

      expect(response.status).toBe(409);
      expect(runner.calls.filter((call) => call.startsWith('answer'))).toEqual([]);
    });
  });

  it('should settle a finished run only after start has been called', async () => {
    const runFinished = {
      runId: 'run-1',
      projectId: 'moritz/aisf',
      ticketNumber: 138,
      ending: { kind: 'stopped' },
    } as const;

    bus.emit('run.finished', runFinished);
    await Promise.resolve();
    expect(runner.calls).toEqual([]);

    scheduler.start();
    bus.emit('run.finished', runFinished);

    await vi.waitFor(() => expect(runner.calls).toEqual(['settle run-1']));
  });

  it('should rebase-merge an approved pull request only after start has been called', async () => {
    const snapshotChanged = {
      projectId: 'moritz/aisf',
      addedTicketNumbers: [],
      changedTicketNumbers: [140],
      removedTicketNumbers: [],
    };

    bus.emit('snapshot.changed', snapshotChanged);
    await Promise.resolve();
    expect(pullRequestMerges.calls).toEqual([]);

    scheduler.start();
    bus.emit('snapshot.changed', snapshotChanged);

    await vi.waitFor(() => expect(pullRequestMerges.calls).toEqual(['merge #201 abc123']));
  });

  it('should publish ticket.status-written on its bus when a run needing permission settles', async () => {
    const listener = vi.fn();
    bus.on('ticket.status-written', listener);
    scheduler.start();

    bus.emit('run.finished', {
      runId: 'run-1',
      projectId: 'moritz/aisf',
      ticketNumber: 138,
      ending: { kind: 'permission-needed', toolName: 'Bash', toolInput: {} },
    });

    await vi.waitFor(() =>
      expect(listener).toHaveBeenCalledWith(expect.objectContaining({ to: 'stuck' })),
    );
  });
});
