import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConflictError } from '../../shared/errors.js';
import type { DomainEvents } from '../../shared/event-bus.js';
import { InMemoryEventBus } from '../../shared/in-memory-event-bus.js';
import { createSchedulerModule, type SchedulerModule } from './index.js';
import {
  FakeRunnerApi,
  FakeTicketsApi,
  buildRunDto,
  buildTicketDto,
  fakeProjectsApi,
  fakeSkillsApi,
} from './testing/fake-scheduler-apis.js';
import { FakePullRequestMerges } from './testing/fake-scheduler-ports.js';

const approvedTicket = buildTicketDto({
  number: 140,
  status: 'in-review',
  closingPullRequests: [
    {
      number: 201,
      url: 'https://github.com/moritz/aisf/pull/201',
      state: 'OPEN',
      approved: true,
      checks: 'passing',
      mergeable: 'mergeable',
      canBeRebased: true,
      headCommit: 'abc123',
    },
  ],
});

describe('createSchedulerModule', () => {
  let bus: InMemoryEventBus<DomainEvents>;
  let pullRequestMerges: FakePullRequestMerges;
  let runner: FakeRunnerApi;
  let tickets: FakeTicketsApi;
  let scheduler: SchedulerModule;

  beforeEach(() => {
    bus = new InMemoryEventBus<DomainEvents>();
    pullRequestMerges = new FakePullRequestMerges();
    runner = new FakeRunnerApi();
    tickets = new FakeTicketsApi();
    tickets.openTicketDtos = [approvedTicket];
    scheduler = createSchedulerModule(
      {
        events: bus,
        logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
        projects: fakeProjectsApi(),
        skills: fakeSkillsApi(),
        tickets,
        runner,
      },
      { pullRequestMerges },
    );
  });

  it('should report a ready leaf as available when its run is read', async () => {
    const response = await scheduler.routes.request('/api/projects/moritz/aisf/tickets/138/run');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ availability: { kind: 'available' } });
  });

  it('should report the active run of the ticket when its run is read', async () => {
    runner.activeTicketNumbers = [138];

    const response = await scheduler.routes.request('/api/projects/moritz/aisf/tickets/138/run');

    expect(await response.json()).toEqual({
      availability: { kind: 'disabled', reason: '#138 is running' },
      activeRun: { id: 'run-1', startedAt: '2026-09-29T09:00:00.000Z', steps: [] },
    });
  });

  it('should start the run on the runner and answer 201 when an available ticket is posted', async () => {
    const response = await scheduler.routes.request('/api/projects/moritz/aisf/tickets/138/runs', {
      method: 'POST',
    });

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ id: 'run-1', startedAt: '2026-09-29T09:00:00.000Z' });
    expect(runner.calls).toEqual(['start moritz/aisf #138']);
  });

  it('should answer 409 when the ticket is not available to run', async () => {
    tickets = new FakeTicketsApi(buildTicketDto({ status: 'backlog' }));
    scheduler = createSchedulerModule({
      events: bus,
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      projects: fakeProjectsApi(),
      skills: fakeSkillsApi(),
      tickets,
      runner,
    });

    const response = await scheduler.routes.request('/api/projects/moritz/aisf/tickets/138/runs', {
      method: 'POST',
    });

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ message: 'Ticket #138 cannot be run' });
  });

  it('should answer 409 when an available ticket is posted while it already has a run active', async () => {
    runner.activeTicketNumbers = [138];

    const response = await scheduler.routes.request('/api/projects/moritz/aisf/tickets/138/runs', {
      method: 'POST',
    });

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ message: '#138 is running' });
  });

  it('should answer 409 when the runner reports a run already active', async () => {
    runner.startResult = { kind: 'already-active', message: 'A run is already active' };

    const response = await scheduler.routes.request('/api/projects/moritz/aisf/tickets/138/runs', {
      method: 'POST',
    });

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ message: 'A run is already active' });
  });

  it('should answer 409 when an answer arrives for a run that already resumed', async () => {
    runner.record = buildRunDto({
      id: 'r1',
      ticketNumber: 7,
      waitingFor: { kind: 'checkpoint', request: 'Pick A or B' },
    });
    runner.latest = runner.record;
    runner.answerResult = { kind: 'already-active', message: 'A run is already active' };

    const response = await scheduler.routes.request('/api/runs/r1/checkpoint', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ answer: 'A' }),
    });

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ message: 'A run is already active' });
    expect(tickets.calls).toEqual(['begin moritz/aisf #7', 'revert moritz/aisf #7']);
  });

  it('should answer a live-waiting run through internal.answer like the checkpoint route', async () => {
    runner.record = buildRunDto({
      id: 'r1',
      ticketNumber: 7,
      waitingFor: { kind: 'checkpoint', request: 'Pick A or B' },
    });
    runner.latest = runner.record;

    const started = await scheduler.internal.answer('r1', { kind: 'checkpoint', text: 'A' });

    expect(started).toEqual({ id: 'run-2', startedAt: '2026-09-29T11:00:00.000Z' });
    expect(tickets.calls).toEqual(['begin moritz/aisf #7']);
    expect(runner.calls).toContain(
      `answer r1 ${JSON.stringify({ kind: 'checkpoint', text: 'A' })}`,
    );
  });

  it('should throw a plain ConflictError from internal.answer when the run is unknown', async () => {
    const failure: unknown = await scheduler.internal
      .answer('r9', { kind: 'checkpoint', text: 'A' })
      .catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(ConflictError);
    expect((failure as Error).constructor).toBe(ConflictError);
  });

  it('should rebase-merge an approved pull request when snapshot.changed is emitted', async () => {
    bus.emit('snapshot.changed', {
      projectId: 'moritz/aisf',
      addedTicketNumbers: [],
      changedTicketNumbers: [140],
      removedTicketNumbers: [],
    });

    await vi.waitFor(() => expect(pullRequestMerges.calls).toEqual(['merge #201 abc123']));
  });

  it('should create the idea and start its run when the ideas route is posted', async () => {
    tickets = new FakeTicketsApi(buildTicketDto({ number: 501, status: 'idea' }));
    scheduler = createSchedulerModule({
      events: bus,
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      projects: fakeProjectsApi(),
      skills: fakeSkillsApi(),
      tickets,
      runner,
    });

    const response = await scheduler.routes.request('/api/projects/moritz/aisf/ideas', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: 'Export trips as postcards' }),
    });

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ ticketNumber: 501 });
    expect(tickets.calls).toEqual(['create {"title":"Export trips as postcards","body":""}']);
    expect(runner.calls).toEqual(['start moritz/aisf #501']);
  });
});
