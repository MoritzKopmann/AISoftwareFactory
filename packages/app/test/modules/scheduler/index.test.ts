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
      reviewDecision: 'APPROVED',
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
  let scheduler: SchedulerModule;

  beforeEach(() => {
    bus = new TypedEventBus<AisfEventMap>();
    pullRequestMerges = new FakePullRequestMerges();
    runner = new FakeRunnerPort();
    scheduler = createSchedulerModule({
      ticketStatusWrites: new FakeTicketStatusWrites(),
      pullRequestMerges,
      runner,
      ticketLookup: new FakeTicketLookup(readyLeaf),
      reviewedTicketLookup: new FakeReviewedTicketLookup([approvedTicket]),
      runsGate: new FakeRunsGate(),
      projectLookup: new FakeProjectLookup(),
      subscriber: bus,
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    });
  });

  it('should report a ready leaf as available when its run is read', async () => {
    const response = await scheduler.routes.request('/projects/moritz/aisf/tickets/138/run');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ availability: { kind: 'available' } });
  });

  it('should report the active run of the ticket when its run is read', async () => {
    runner.activeTicketNumber = 138;

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

  it('should answer 409 when an available ticket is posted while another run is active', async () => {
    runner.activeTicketNumber = 42;

    const response = await scheduler.routes.request('/projects/moritz/aisf/tickets/138/runs', {
      method: 'POST',
    });

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ message: '#42 is running' });
  });

  it('should answer 409 when the runner reports a run already active', async () => {
    runner.startFailure = new RunAlreadyActiveError('A run is already active');

    const response = await scheduler.routes.request('/projects/moritz/aisf/tickets/138/runs', {
      method: 'POST',
    });

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ message: 'A run is already active' });
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
      expect(runner.calls).toContain('resume run-1 allow');
    });

    it('should answer 409 and resume nothing when the ticket is not stuck', async () => {
      const ticketStatusWrites = new FakeTicketStatusWrites();

      const response = await postAnswer(answerWith(ticketStatusWrites));

      expect(response.status).toBe(409);
      expect(runner.calls.filter((call) => call.startsWith('resume'))).toEqual([]);
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
});
