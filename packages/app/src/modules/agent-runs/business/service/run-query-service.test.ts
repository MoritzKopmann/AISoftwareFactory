import { describe, expect, it } from 'vitest';
import type { RunLogEntry } from '../domain/types/run-log-entry.js';
import { TranscriptNotFoundError } from '../errors/transcript-not-found-error.js';
import {
  buildRun,
  FakeRecentRunSteps,
  FakeRunRepository,
  FakeRunTranscripts,
} from '../../testing/fake-agent-runs-ports.js';
import { RunQueryService } from './run-query-service.js';

function query(
  runRepository: FakeRunRepository,
  recentRunSteps = new FakeRecentRunSteps(),
  runTranscripts = new FakeRunTranscripts(),
): RunQueryService {
  return new RunQueryService({ runRepository, recentRunSteps, runTranscripts });
}

function buildEntries(count: number): ReadonlyArray<RunLogEntry> {
  return Array.from({ length: count }, (_, index) => ({ summary: `Step ${index + 1}` }));
}

async function createSubject() {
  const runRepository = new FakeRunRepository();
  await runRepository.insert(buildRun({ state: 'ended', ending: { kind: 'finished' } }));
  const runTranscripts = new FakeRunTranscripts();
  const subject = query(runRepository, new FakeRecentRunSteps(), runTranscripts);
  return { subject, runRepository, runTranscripts };
}

describe('RunQueryService', () => {
  describe('readActive', () => {
    it('should return each running run with its recent steps', async () => {
      const runRepository = new FakeRunRepository();
      const recentRunSteps = new FakeRecentRunSteps();
      const run = buildRun();
      await runRepository.insert(run);
      recentRunSteps.append('run-1', { at: 'a', summary: 'Read package.json' });

      const otherRun = buildRun({ id: 'run-2', ticketNumber: 12 });
      await runRepository.insert(otherRun);

      const activeRuns = await query(runRepository, recentRunSteps).readActive('moritz/aisf');

      expect(activeRuns).toEqual([
        { run, steps: [{ at: 'a', summary: 'Read package.json' }] },
        { run: otherRun, steps: [] },
      ]);
    });

    it('should return nothing when no run in the project is running', async () => {
      const activeRuns = await query(new FakeRunRepository(), new FakeRecentRunSteps()).readActive(
        'moritz/aisf',
      );

      expect(activeRuns).toEqual([]);
    });
  });

  describe('readActiveWaits', () => {
    it('should name each kind of wait when active runs wait for the human', async () => {
      const runRepository = new FakeRunRepository();
      await runRepository.insert(
        buildRun({
          id: 'run-1',
          ticketNumber: 5,
          waitingFor: { kind: 'checkpoint', request: 'Look', artifactId: 'page' },
          waitingSince: '2026-10-01T10:00:00Z',
        }),
      );
      await runRepository.insert(
        buildRun({
          id: 'run-2',
          ticketNumber: 6,
          waitingFor: { kind: 'checkpoint', request: 'Which one?' },
          waitingSince: '2026-10-01T10:01:00Z',
        }),
      );
      await runRepository.insert(
        buildRun({
          id: 'run-3',
          ticketNumber: 7,
          waitingFor: { kind: 'permission-needed', toolName: 'Bash', toolInput: {} },
          waitingSince: '2026-10-01T10:02:00Z',
        }),
      );

      const waits = await query(runRepository).readActiveWaits('moritz/aisf');

      expect(waits).toEqual([
        { ticketNumber: 5, kind: 'round', since: '2026-10-01T10:00:00Z' },
        { ticketNumber: 6, kind: 'question', since: '2026-10-01T10:01:00Z' },
        { ticketNumber: 7, kind: 'permission', since: '2026-10-01T10:02:00Z' },
      ]);
    });

    it('should skip active runs when they are not waiting', async () => {
      const runRepository = new FakeRunRepository();
      await runRepository.insert(buildRun());

      expect(await query(runRepository).readActiveWaits('moritz/aisf')).toEqual([]);
    });
  });

  describe('readLatest', () => {
    it('should return the latest run of the ticket when it has one', async () => {
      const runRepository = new FakeRunRepository();
      const run = buildRun({ state: 'ended', ending: { kind: 'finished' } });
      await runRepository.insert(run);

      expect(await query(runRepository).readLatest('moritz/aisf', 137)).toEqual(run);
    });

    it('should return undefined when the ticket has no run', async () => {
      const latestRun = await query(new FakeRunRepository()).readLatest('moritz/aisf', 137);

      expect(latestRun).toBeUndefined();
    });
  });

  describe('readTicketLog', () => {
    it('should return the transcript entries in order when the ticket has a run', async () => {
      const { subject, runTranscripts } = await createSubject();
      runTranscripts.entries = [{ summary: 'Read: ticket' }, { summary: 'Bash: npm test' }];

      expect(await subject.readTicketLog('moritz/aisf', 137)).toEqual({
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

      expect(await subject.readTicketLog('moritz/aisf', 137)).toEqual({
        kind: 'found',
        entries: [{ summary: 'Read: ticket' }],
        total: 1,
      });
      expect(runTranscripts.reads.map((read) => read.sessionId)).toEqual(['session-2']);
    });

    it('should return no session when the ticket has no run', async () => {
      const { subject } = await createSubject();

      expect(await subject.readTicketLog('moritz/aisf', 999)).toEqual({ kind: 'no-session' });
    });

    it('should return transcript not found when Claude Code has removed the transcript', async () => {
      const { subject, runTranscripts } = await createSubject();
      runTranscripts.failure = new TranscriptNotFoundError('session-1');

      expect(await subject.readTicketLog('moritz/aisf', 137)).toEqual({
        kind: 'transcript-not-found',
      });
    });

    it('should return the last 200 entries and the total when the transcript has more', async () => {
      const { subject, runTranscripts } = await createSubject();
      runTranscripts.entries = buildEntries(250);

      expect(await subject.readTicketLog('moritz/aisf', 137)).toEqual({
        kind: 'found',
        entries: buildEntries(250).slice(50),
        total: 250,
      });
    });

    it('should rethrow an unexpected transcript failure', async () => {
      const { subject, runTranscripts } = await createSubject();
      runTranscripts.failure = new Error('disk failure');

      await expect(subject.readTicketLog('moritz/aisf', 137)).rejects.toThrow('disk failure');
    });
  });
});
