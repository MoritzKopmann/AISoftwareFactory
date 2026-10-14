import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createSchedulerModule,
  RunAlreadyActiveError,
  type SchedulerModule,
} from '../../../src/modules/scheduler/index.js';
import type { ReviewedTicket } from '../../../src/modules/scheduler/logic/domain/types/reviewed-ticket.js';
import type { DomainEvents } from '../../../src/shared/event-bus.js';
import { InMemoryEventBus } from '../../../src/shared/in-memory-event-bus.js';
import {
  FakeIdeaCreation,
  FakeProjectLookup,
  FakePullRequestMerges,
  FakeReviewedTicketLookup,
  FakeRunnerPort,
  FakeRunsGate,
  FakeTicketLookup,
  FakeTicketAnswerGate,
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
  let bus: InMemoryEventBus<DomainEvents>;
  let pullRequestMerges: FakePullRequestMerges;
  let runner: FakeRunnerPort;
  let ticketAnswerGate: FakeTicketAnswerGate;
  let scheduler: SchedulerModule;
  let ideaCreation: FakeIdeaCreation;

  beforeEach(() => {
    bus = new InMemoryEventBus<DomainEvents>();
    pullRequestMerges = new FakePullRequestMerges();
    runner = new FakeRunnerPort();
    ideaCreation = new FakeIdeaCreation();
    ticketAnswerGate = new FakeTicketAnswerGate();
    scheduler = createSchedulerModule({
      ticketAnswerGate,
      pullRequestMerges,
      runner,
      ticketLookup: new FakeTicketLookup(readyLeaf),
      reviewedTicketLookup: new FakeReviewedTicketLookup([approvedTicket]),
      runsGate: new FakeRunsGate(),
      projectLookup: new FakeProjectLookup(),
      ideaCreation,
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

    const started = await scheduler.answer('r1', { kind: 'checkpoint', text: 'A' });

    expect(started).toEqual({ id: 'run-2', startedAt: '2026-09-29T11:00:00.000Z' });
    expect(ticketAnswerGate.calls).toEqual(['begin moritz/aisf #7']);
    expect(runner.calls).toContain(
      `answer r1 ${JSON.stringify({ kind: 'checkpoint', text: 'A' })}`,
    );
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

  it('should create the idea and start its run when the ideas route is posted', async () => {
    const response = await scheduler.routes.request('/projects/moritz/aisf/ideas', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: 'Export trips as postcards' }),
    });

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ ticketNumber: 501 });
    expect(ideaCreation.calls).toEqual(['create {"title":"Export trips as postcards","body":""}']);
    expect(runner.calls).toEqual(['start moritz/aisf #501']);
  });
});
