import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createSchedulerModule,
  RunNotAvailableError,
  type SchedulerModule,
} from '../../../src/modules/scheduler/index.js';
import type { AisfEventMap } from '../../../src/shared/bus/aisf-event-map.js';
import { TypedEventBus } from '../../../src/shared/bus/typed-event-bus.js';
import {
  FakeGitHubWrites,
  FakeProjectLookup,
  FakeRunnerPort,
  FakeRunsGate,
  FakeTicketLookup,
  readyLeaf,
} from './fakes/fake-scheduler-ports.js';

describe('createSchedulerModule', () => {
  let bus: TypedEventBus<AisfEventMap>;
  let gitHubWrites: FakeGitHubWrites;
  let runner: FakeRunnerPort;
  let scheduler: SchedulerModule;

  beforeEach(() => {
    bus = new TypedEventBus<AisfEventMap>();
    gitHubWrites = new FakeGitHubWrites();
    runner = new FakeRunnerPort();
    scheduler = createSchedulerModule({
      gitHubWrites,
      runner,
      ticketLookup: new FakeTicketLookup(readyLeaf),
      runsGate: new FakeRunsGate(),
      projectLookup: new FakeProjectLookup(),
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
});
