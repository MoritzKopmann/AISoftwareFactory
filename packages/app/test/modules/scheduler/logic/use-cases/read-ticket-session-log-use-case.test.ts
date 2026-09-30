import { describe, expect, it } from 'vitest';
import { ReadTicketSessionLogUseCase } from '../../../../../src/modules/scheduler/logic/use-cases/read-ticket-session-log-use-case.js';
import { FakeRunnerPort } from '../../fakes/fake-scheduler-ports.js';

describe('ReadTicketSessionLogUseCase', () => {
  it('should return the session log of the latest run when the ticket has run', async () => {
    const runner = new FakeRunnerPort();
    runner.latest = { id: 'run-2', startedAt: '2026-09-29T09:00:00.000Z' };
    runner.transcript = {
      kind: 'found',
      entries: [{ summary: 'Read: ticket' }],
      total: 1,
    };

    const sessionLog = await new ReadTicketSessionLogUseCase({ runner }).execute(
      'moritz/aisf',
      138,
    );

    expect(sessionLog).toEqual({ kind: 'found', entries: [{ summary: 'Read: ticket' }], total: 1 });
    expect(runner.calls).toEqual(['sessionLog run-2']);
  });

  it('should return no session when the ticket has no run', async () => {
    const runner = new FakeRunnerPort();

    const sessionLog = await new ReadTicketSessionLogUseCase({ runner }).execute(
      'moritz/aisf',
      138,
    );

    expect(sessionLog).toEqual({ kind: 'no-session' });
    expect(runner.calls).toEqual([]);
  });

  it('should return transcript not found when the runner cannot find the transcript', async () => {
    const runner = new FakeRunnerPort();
    runner.latest = { id: 'run-2', startedAt: '2026-09-29T09:00:00.000Z' };
    runner.transcript = { kind: 'transcript-not-found' };

    const sessionLog = await new ReadTicketSessionLogUseCase({ runner }).execute(
      'moritz/aisf',
      138,
    );

    expect(sessionLog).toEqual({ kind: 'transcript-not-found' });
  });
});
