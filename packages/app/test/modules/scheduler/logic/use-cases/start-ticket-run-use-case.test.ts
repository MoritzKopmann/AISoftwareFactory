import { describe, expect, it } from 'vitest';
import { RunNotAvailableError } from '../../../../../src/modules/scheduler/logic/errors/run-not-available-error.js';
import { ReadRunAvailabilityUseCase } from '../../../../../src/modules/scheduler/logic/use-cases/read-run-availability-use-case.js';
import { StartTicketRunUseCase } from '../../../../../src/modules/scheduler/logic/use-cases/start-ticket-run-use-case.js';
import {
  FakeProjectLookup,
  FakeRunnerPort,
  FakeRunsGate,
  FakeTicketLookup,
  readyLeaf,
} from '../../fakes/fake-scheduler-ports.js';

function buildUseCase(
  runner: FakeRunnerPort,
  ticketLookup = new FakeTicketLookup(readyLeaf),
): StartTicketRunUseCase {
  const readRunAvailability = new ReadRunAvailabilityUseCase({
    ticketLookup,
    runner,
    runsGate: new FakeRunsGate(),
    projectLookup: new FakeProjectLookup(),
  });
  return new StartTicketRunUseCase({
    readRunAvailability: (projectId, ticketNumber) =>
      readRunAvailability.execute(projectId, ticketNumber),
    runner,
  });
}

describe('StartTicketRunUseCase', () => {
  it('should start the run on the runner when the run is available', async () => {
    const runner = new FakeRunnerPort();

    await buildUseCase(runner).execute('moritz/aisf', 138);

    expect(runner.calls).toEqual(['start moritz/aisf #138']);
  });

  it('should throw RunNotAvailableError with the reason and start nothing when the ticket already has a run active', async () => {
    const runner = new FakeRunnerPort();
    runner.activeTicketNumbers = [138];

    await expect(buildUseCase(runner).execute('moritz/aisf', 138)).rejects.toThrow(
      new RunNotAvailableError('#138 is running'),
    );
    expect(runner.calls).toEqual([]);
  });

  it('should throw RunNotAvailableError and start nothing when the ticket is not runnable', async () => {
    const runner = new FakeRunnerPort();
    const ticketLookup = new FakeTicketLookup({ ...readyLeaf, hasOpenBlocker: true });

    await expect(buildUseCase(runner, ticketLookup).execute('moritz/aisf', 138)).rejects.toThrow(
      RunNotAvailableError,
    );
    expect(runner.calls).toEqual([]);
  });
});
