import { describe, expect, it } from 'vitest';
import { ReadRunAvailabilityUseCase } from '../../../../../src/modules/scheduler/logic/use-cases/read-run-availability-use-case.js';
import {
  FakeProjectLookup,
  FakeRunnerPort,
  FakeRunsGate,
  FakeTicketLookup,
  readyLeaf,
  repository,
} from '../../fakes/fake-scheduler-ports.js';

function buildUseCase(
  overrides: Partial<ConstructorParameters<typeof ReadRunAvailabilityUseCase>[0]> = {},
): ReadRunAvailabilityUseCase {
  return new ReadRunAvailabilityUseCase({
    ticketLookup: new FakeTicketLookup(readyLeaf),
    runner: new FakeRunnerPort(),
    runsGate: new FakeRunsGate(),
    projectLookup: new FakeProjectLookup(),
    ...overrides,
  });
}

describe('ReadRunAvailabilityUseCase', () => {
  it('should be available when the ticket is a ready leaf and nothing prevents a run', async () => {
    expect(await buildUseCase().execute('moritz/aisf', 138)).toEqual({ kind: 'available' });
  });

  it('should be absent when the ticket is unknown', async () => {
    const useCase = buildUseCase({ ticketLookup: new FakeTicketLookup(undefined) });

    expect(await useCase.execute('moritz/aisf', 138)).toEqual({ kind: 'absent' });
  });

  it('should be disabled naming the ticket when it already has a run active', async () => {
    const runner = new FakeRunnerPort();
    runner.activeTicketNumbers = [138];

    expect(await buildUseCase({ runner }).execute('moritz/aisf', 138)).toEqual({
      kind: 'disabled',
      reason: '#138 is running',
    });
  });

  it('should be available when only another ticket has a run active', async () => {
    const runner = new FakeRunnerPort();
    runner.activeTicketNumbers = [42];

    expect(await buildUseCase({ runner }).execute('moritz/aisf', 138)).toEqual({
      kind: 'available',
    });
  });

  it('should be disabled with the reason when runs are blocked', async () => {
    const useCase = buildUseCase({
      runsGate: new FakeRunsGate({ blocked: true, reason: 'Not logged in' }),
    });

    expect(await useCase.execute('moritz/aisf', 138)).toEqual({
      kind: 'disabled',
      reason: 'Not logged in',
    });
  });

  it('should be disabled when the project is not onboarded', async () => {
    const useCase = buildUseCase({
      projectLookup: new FakeProjectLookup({ repository, onboarded: false }),
    });

    expect(await useCase.execute('moritz/aisf', 138)).toEqual({
      kind: 'disabled',
      reason: 'The project is not onboarded',
    });
  });

  it("should be disabled when the snapshot predates the ticket's last run end", async () => {
    const runner = new FakeRunnerPort();
    runner.latest = {
      id: 'run-0',
      startedAt: '2026-09-29T10:00:00.000Z',
      endedAt: '2026-09-29T10:05:00.000Z',
      ending: { kind: 'finished' },
    };

    expect(await buildUseCase({ runner }).execute('moritz/aisf', 138)).toEqual({
      kind: 'disabled',
      reason: 'Waiting for GitHub to catch up',
    });
  });
});
