import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createFindingReportingTool,
  createSchedulerModule,
  FindingNotOpenError,
  RunNotAvailableError,
  type SchedulerModule,
} from '../../../src/modules/scheduler/index.js';
import type { ReviewedTicket } from '../../../src/modules/scheduler/logic/domain/types/reviewed-ticket.js';
import type { AisfEventMap } from '../../../src/shared/bus/aisf-event-map.js';
import { TypedEventBus } from '../../../src/shared/bus/typed-event-bus.js';
import {
  FakeGitHubWrites,
  FakeProjectLookup,
  FakeReviewedTicketLookup,
  FakeRunnerPort,
  FakeRunsGate,
  FakeTicketLookup,
  readyLeaf,
} from './fakes/fake-scheduler-ports.js';
import { InMemoryFindingRepository } from './fakes/in-memory-finding-repository.js';

const clock = { now: () => '2026-09-29T10:00:00.000Z' };
const runContext = {
  runId: 'run-1',
  projectId: 'moritz/aisf',
  ticketNumber: 138,
  worktreePath: '/worktrees/aisf/138',
};

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
  let gitHubWrites: FakeGitHubWrites;
  let runner: FakeRunnerPort;
  let findingRepository: InMemoryFindingRepository;
  let scheduler: SchedulerModule;

  beforeEach(() => {
    bus = new TypedEventBus<AisfEventMap>();
    gitHubWrites = new FakeGitHubWrites();
    runner = new FakeRunnerPort();
    findingRepository = new InMemoryFindingRepository();
    scheduler = createSchedulerModule({
      gitHubWrites,
      runner,
      ticketLookup: new FakeTicketLookup(readyLeaf),
      reviewedTicketLookup: new FakeReviewedTicketLookup([approvedTicket]),
      runsGate: new FakeRunsGate(),
      projectLookup: new FakeProjectLookup(),
      findingRepository,
      clock,
      subscriber: bus,
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    });
  });

  it('should report a ready leaf as available when runAvailability is asked', async () => {
    expect(await scheduler.runAvailability('moritz/aisf', 138)).toEqual({ kind: 'available' });
  });

  it('should start the run on the runner when startRun is called for an available ticket', async () => {
    await scheduler.startRun('moritz/aisf', 138);

    expect(runner.calls).toEqual(['start moritz/aisf #138']);
  });

  it('should return the started run when startRun is called for an available ticket', async () => {
    expect(await scheduler.startRun('moritz/aisf', 138)).toEqual({
      id: 'run-1',
      startedAt: '2026-09-29T09:00:00.000Z',
    });
  });

  it('should throw RunNotAvailableError when startRun is called while another run is active', async () => {
    runner.activeTicketNumber = 42;

    await expect(scheduler.startRun('moritz/aisf', 138)).rejects.toThrow(RunNotAvailableError);
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
    expect(gitHubWrites.calls).toEqual([]);

    scheduler.start();
    bus.emit('snapshot.changed', snapshotChanged);

    await vi.waitFor(() => expect(gitHubWrites.calls).toEqual(['rebaseMerge #201 abc123']));
  });

  describe('findings', () => {
    beforeEach(async () => {
      await createFindingReportingTool({ findingRepository, clock }).execute(
        { kind: 'bug', location: 'src/a.ts:12', summary: 'Loop never ends' },
        runContext,
      );
    });

    it('should list a reported finding when listFindings is called for its ticket', async () => {
      expect(await scheduler.listFindings('moritz/aisf', 138)).toMatchObject([
        { id: 1, ticketNumber: 138, state: 'open' },
      ]);
    });

    it('should create one bare idea and mark the finding ticketed when createTicketFromFinding is called', async () => {
      gitHubWrites.createdIssueNumber = 210;

      const finding = await scheduler.createTicketFromFinding('moritz/aisf', 1);

      expect(finding).toMatchObject({ state: 'ticketed', createdTicketNumber: 210 });
      expect(gitHubWrites.createdIssues).toHaveLength(1);
    });

    it('should throw FindingNotOpenError when createTicketFromFinding is called twice', async () => {
      await scheduler.createTicketFromFinding('moritz/aisf', 1);

      await expect(scheduler.createTicketFromFinding('moritz/aisf', 1)).rejects.toThrow(
        FindingNotOpenError,
      );
    });

    it('should keep the finding as dismissed when dismissFinding is called', async () => {
      await scheduler.dismissFinding('moritz/aisf', 1);

      expect(await scheduler.listFindings('moritz/aisf')).toMatchObject([{ state: 'dismissed' }]);
    });
  });
});
