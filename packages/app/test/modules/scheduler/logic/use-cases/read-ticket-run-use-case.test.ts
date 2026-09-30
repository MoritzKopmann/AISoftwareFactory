import { describe, expect, it } from 'vitest';
import type { RunAvailability } from '../../../../../src/modules/scheduler/logic/domain/types/run-availability.js';
import { ReadTicketRunUseCase } from '../../../../../src/modules/scheduler/logic/use-cases/read-ticket-run-use-case.js';
import { FakeRunnerPort } from '../../fakes/fake-scheduler-ports.js';

const startedAt = '2026-09-29T09:00:00.000Z';
const endedAt = '2026-09-29T09:30:00.000Z';

function buildUseCase(
  runner: FakeRunnerPort,
  availability: RunAvailability = { kind: 'available' },
): ReadTicketRunUseCase {
  return new ReadTicketRunUseCase({ readRunAvailability: async () => availability, runner });
}

describe('ReadTicketRunUseCase', () => {
  it('should return only the availability when the ticket never ran', async () => {
    const useCase = buildUseCase(new FakeRunnerPort(), {
      kind: 'disabled',
      reason: '#42 is running',
    });

    expect(await useCase.execute('moritz/aisf', 138)).toEqual({
      availability: { kind: 'disabled', reason: '#42 is running' },
    });
  });

  it('should return the active run with its steps when the active run is this ticket', async () => {
    const runner = new FakeRunnerPort();
    runner.activeTicketNumber = 138;
    runner.activeSteps = [{ at: '2026-09-29T09:01:00.000Z', summary: 'Read the ticket' }];

    expect(await buildUseCase(runner).execute('moritz/aisf', 138)).toEqual({
      availability: { kind: 'available' },
      activeRun: {
        id: 'run-1',
        startedAt,
        steps: [{ at: '2026-09-29T09:01:00.000Z', summary: 'Read the ticket' }],
      },
    });
  });

  it('should leave out the active run when the active run is another ticket', async () => {
    const runner = new FakeRunnerPort();
    runner.activeTicketNumber = 42;

    const ticketRun = await buildUseCase(runner).execute('moritz/aisf', 138);

    expect(ticketRun.activeRun).toBeUndefined();
  });

  it('should return the last run when the latest run has an ending and an end time', async () => {
    const runner = new FakeRunnerPort();
    runner.latest = {
      id: 'run-0',
      startedAt,
      endedAt,
      ending: { kind: 'escalated', escalation: 'spec', reason: 'AC 2 is unclear' },
    };

    const ticketRun = await buildUseCase(runner).execute('moritz/aisf', 138);

    expect(ticketRun.lastRun).toEqual({
      id: 'run-0',
      startedAt,
      endedAt,
      ending: { kind: 'escalated', escalation: 'spec', reason: 'AC 2 is unclear' },
    });
  });

  it('should leave out the last run when the latest run has not ended', async () => {
    const runner = new FakeRunnerPort();
    runner.latest = { id: 'run-0', startedAt };

    const ticketRun = await buildUseCase(runner).execute('moritz/aisf', 138);

    expect(ticketRun.lastRun).toBeUndefined();
  });

  it('should leave out the last run when the latest run has an end time but no ending', async () => {
    const runner = new FakeRunnerPort();
    runner.latest = { id: 'run-0', startedAt, endedAt };

    const ticketRun = await buildUseCase(runner).execute('moritz/aisf', 138);

    expect(ticketRun.lastRun).toBeUndefined();
  });
});
