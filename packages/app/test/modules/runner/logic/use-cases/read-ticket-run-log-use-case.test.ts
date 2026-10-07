import { describe, expect, it } from 'vitest';
import type { RunLogEntry } from '../../../../../src/modules/runner/logic/domain/types/run-log-entry.js';
import { TranscriptNotFoundError } from '../../../../../src/modules/runner/logic/errors/transcript-not-found-error.js';
import { ReadTicketRunLogUseCase } from '../../../../../src/modules/runner/logic/use-cases/read-ticket-run-log-use-case.js';
import { buildRun, FakeRunRepository, FakeRunTranscripts } from '../../fakes/fake-runner-ports.js';

function buildEntries(count: number): ReadonlyArray<RunLogEntry> {
  return Array.from({ length: count }, (_, index) => ({ summary: `Step ${index + 1}` }));
}

async function createSubject() {
  const runRepository = new FakeRunRepository();
  await runRepository.insert(buildRun({ state: 'ended', ending: { kind: 'finished' } }));
  const runTranscripts = new FakeRunTranscripts();
  const subject = new ReadTicketRunLogUseCase({ runRepository, runTranscripts });
  return { subject, runRepository, runTranscripts };
}

describe('ReadTicketRunLogUseCase', () => {
  it('should return the transcript entries in order when the ticket has a run', async () => {
    const { subject, runTranscripts } = await createSubject();
    runTranscripts.entries = [{ summary: 'Read: ticket' }, { summary: 'Bash: npm test' }];

    expect(await subject.execute('moritz/aisf', 137)).toEqual({
      kind: 'found',
      entries: [{ summary: 'Read: ticket' }, { summary: 'Bash: npm test' }],
      total: 2,
    });
    expect(runTranscripts.reads).toEqual([
      { sessionId: 'session-1', worktreePath: '/worktrees/aisf/137' },
    ]);
  });

  it('should read the later-started run when the ticket has two runs', async () => {
    const { subject, runRepository, runTranscripts } = await createSubject();
    await runRepository.insert(
      buildRun({
        id: 'run-2',
        sessionId: 'session-2',
        state: 'ended',
        ending: { kind: 'finished' },
        startedAt: '2026-09-29T11:00:00.000Z',
      }),
    );
    runTranscripts.entries = [{ summary: 'Read: ticket' }];

    expect(await subject.execute('moritz/aisf', 137)).toEqual({
      kind: 'found',
      entries: [{ summary: 'Read: ticket' }],
      total: 1,
    });
    expect(runTranscripts.reads.map((read) => read.sessionId)).toEqual(['session-2']);
  });

  it('should return no session when the ticket has no run', async () => {
    const { subject } = await createSubject();

    expect(await subject.execute('moritz/aisf', 999)).toEqual({ kind: 'no-session' });
  });

  it('should return transcript not found when Claude Code has removed the transcript', async () => {
    const { subject, runTranscripts } = await createSubject();
    runTranscripts.failure = new TranscriptNotFoundError('session-1');

    expect(await subject.execute('moritz/aisf', 137)).toEqual({ kind: 'transcript-not-found' });
  });

  it('should return the last 200 entries and the total when the transcript has more', async () => {
    const { subject, runTranscripts } = await createSubject();
    runTranscripts.entries = buildEntries(250);

    expect(await subject.execute('moritz/aisf', 137)).toEqual({
      kind: 'found',
      entries: buildEntries(250).slice(50),
      total: 250,
    });
  });

  it('should rethrow an unexpected transcript failure', async () => {
    const { subject, runTranscripts } = await createSubject();
    runTranscripts.failure = new Error('disk failure');

    await expect(subject.execute('moritz/aisf', 137)).rejects.toThrow('disk failure');
  });
});
