import { describe, expect, it } from 'vitest';
import type { SessionLogEntry } from '../../../../../src/modules/runner/logic/domain/types/session-log-entry.js';
import { TranscriptNotFoundError } from '../../../../../src/modules/runner/logic/errors/transcript-not-found-error.js';
import { ReadSessionLogUseCase } from '../../../../../src/modules/runner/logic/use-cases/read-session-log-use-case.js';
import {
  buildRun,
  FakeRunRepository,
  FakeSessionTranscripts,
} from '../../fakes/fake-runner-ports.js';

function buildEntries(count: number): ReadonlyArray<SessionLogEntry> {
  return Array.from({ length: count }, (_, index) => ({ summary: `Step ${index + 1}` }));
}

async function createSubject() {
  const runRepository = new FakeRunRepository();
  await runRepository.insert(buildRun({ state: 'ended', ending: { kind: 'finished' } }));
  const sessionTranscripts = new FakeSessionTranscripts();
  const subject = new ReadSessionLogUseCase({ runRepository, sessionTranscripts });
  return { subject, sessionTranscripts };
}

describe('ReadSessionLogUseCase', () => {
  it('should return the transcript entries in order when the run has a transcript', async () => {
    const { subject, sessionTranscripts } = await createSubject();
    sessionTranscripts.entries = [{ summary: 'Read: ticket' }, { summary: 'Bash: npm test' }];

    expect(await subject.execute('run-1')).toEqual({
      kind: 'found',
      entries: [{ summary: 'Read: ticket' }, { summary: 'Bash: npm test' }],
      total: 2,
    });
    expect(sessionTranscripts.reads).toEqual([
      { sessionId: 'session-1', worktreePath: '/worktrees/aisf/137' },
    ]);
  });

  it('should return no session when the run is unknown', async () => {
    const { subject } = await createSubject();

    expect(await subject.execute('missing-run')).toEqual({ kind: 'no-session' });
  });

  it('should return transcript not found when Claude Code has removed the transcript', async () => {
    const { subject, sessionTranscripts } = await createSubject();
    sessionTranscripts.failure = new TranscriptNotFoundError('session-1');

    expect(await subject.execute('run-1')).toEqual({ kind: 'transcript-not-found' });
  });

  it('should return the last 200 entries and the total when the transcript has more', async () => {
    const { subject, sessionTranscripts } = await createSubject();
    sessionTranscripts.entries = buildEntries(250);

    expect(await subject.execute('run-1')).toEqual({
      kind: 'found',
      entries: buildEntries(250).slice(50),
      total: 250,
    });
  });

  it('should rethrow an unexpected transcript failure', async () => {
    const { subject, sessionTranscripts } = await createSubject();
    sessionTranscripts.failure = new Error('disk failure');

    await expect(subject.execute('run-1')).rejects.toThrow('disk failure');
  });
});
