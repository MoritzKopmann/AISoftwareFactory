import { describe, expect, it } from 'vitest';
import type { RunLogEntry } from '../domain/types/run-log-entry.js';
import { TranscriptNotFoundError } from '../errors/transcript-not-found-error.js';
import {
  buildRun,
  FakeRecentRunSteps,
  FakeRunRepository,
  FakeRunTranscripts,
  FakeSessionFeed,
} from '../../testing/fake-agent-runs-ports.js';
import type { SessionEntry } from '../domain/types/session-entry.js';
import type { TicketSessionWatchEvent } from '../domain/types/ticket-session-watch.js';
import { RunQueryService } from './run-query-service.js';

function query(
  runRepository: FakeRunRepository,
  recentRunSteps = new FakeRecentRunSteps(),
  runTranscripts = new FakeRunTranscripts(),
): RunQueryService {
  return new RunQueryService({
    runRepository,
    recentRunSteps,
    runTranscripts,
    sessionFeed: new FakeSessionFeed(),
  });
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

  describe('watchTicketSession', () => {
    const prompt: SessionEntry = { kind: 'prompt', id: 'm1#0', text: 'Go' };
    const text: SessionEntry = { kind: 'text', id: 'm2#0', text: 'Hi' };
    const call: SessionEntry = {
      kind: 'tool-call',
      id: 'm2#1',
      toolUseId: 't1',
      name: 'Read',
      input: {},
    };
    const result: SessionEntry = {
      kind: 'tool-result',
      id: 'm3#0',
      toolUseId: 't1',
      isError: false,
      parts: [{ kind: 'text', text: 'ok' }],
    };

    async function createWatchSubject(runOverrides: Parameters<typeof buildRun>[0] | 'none' = {}) {
      const runRepository = new FakeRunRepository();
      if (runOverrides !== 'none') {
        await runRepository.insert(buildRun(runOverrides));
      }
      const runTranscripts = new FakeRunTranscripts();
      const sessionFeed = new FakeSessionFeed();
      const subject = new RunQueryService({
        runRepository,
        recentRunSteps: new FakeRecentRunSteps(),
        runTranscripts,
        sessionFeed,
      });
      const events: TicketSessionWatchEvent[] = [];
      const watch = () => subject.watchTicketSession('moritz/aisf', 137, (e) => events.push(e));
      return { runTranscripts, sessionFeed, events, watch };
    }

    it('should send the snapshot then ended when the latest run is finished', async () => {
      const { runTranscripts, events, watch } = await createWatchSubject({ state: 'ended' });
      runTranscripts.sessionEntries = [prompt, text, call, result];

      await watch();

      expect(events).toEqual([
        { kind: 'snapshot', entries: [prompt, text, call, result] },
        { kind: 'ended' },
      ]);
    });

    it('should send no-session when the ticket has no run', async () => {
      const { events, watch } = await createWatchSubject('none');

      await watch();

      expect(events).toEqual([{ kind: 'no-session' }]);
    });

    it('should send transcript-not-found when a finished run has no transcript', async () => {
      const { runTranscripts, events, watch } = await createWatchSubject({ state: 'ended' });
      runTranscripts.sessionEntriesFailure = new TranscriptNotFoundError('missing');

      await watch();

      expect(events).toEqual([{ kind: 'transcript-not-found' }]);
    });

    it('should rethrow when reading the transcript fails otherwise', async () => {
      const { runTranscripts, watch } = await createWatchSubject({ state: 'ended' });
      runTranscripts.sessionEntriesFailure = new Error('boom');

      await expect(watch()).rejects.toThrow('boom');
    });

    it('should add feed-only entries to the snapshot then forward live events when the run is active', async () => {
      const { runTranscripts, sessionFeed, events, watch } = await createWatchSubject();
      sessionFeed.publish('run-1', { kind: 'entry', entry: prompt });
      sessionFeed.publish('run-1', { kind: 'entry', entry: text });
      runTranscripts.sessionEntries = [prompt];

      await watch();
      sessionFeed.publish('run-1', { kind: 'text-delta', opensBlock: true, text: 'Hel' });
      sessionFeed.publish('run-1', { kind: 'entry', entry: call });

      expect(events).toEqual([
        { kind: 'snapshot', entries: [prompt, text] },
        { kind: 'delta', opensBlock: true, text: 'Hel' },
        { kind: 'entry', entry: call },
      ]);
    });

    it('should send an empty snapshot then live events when the transcript is not written yet', async () => {
      const { runTranscripts, sessionFeed, events, watch } = await createWatchSubject();
      sessionFeed.publish('run-1', { kind: 'entry', entry: prompt });
      runTranscripts.sessionEntriesFailure = new TranscriptNotFoundError('missing');

      await watch();
      sessionFeed.publish('run-1', { kind: 'text-delta', opensBlock: false, text: 'x' });

      expect(events).toEqual([
        { kind: 'snapshot', entries: [prompt] },
        { kind: 'delta', opensBlock: false, text: 'x' },
      ]);
    });

    it('should deliver an entry once when it is published while the transcript is read', async () => {
      const { runTranscripts, sessionFeed, events, watch } = await createWatchSubject();
      sessionFeed.publish('run-1', { kind: 'entry', entry: prompt });
      runTranscripts.readEntries = async () => {
        sessionFeed.publish('run-1', { kind: 'entry', entry: text });
        sessionFeed.publish('run-1', { kind: 'text-delta', opensBlock: true, text: 'a' });
        return [prompt, text];
      };

      await watch();

      expect(events).toEqual([
        { kind: 'snapshot', entries: [prompt, text] },
        { kind: 'delta', opensBlock: true, text: 'a' },
      ]);
    });

    it('should send ended when the feed ends while watching', async () => {
      const { sessionFeed, events, watch } = await createWatchSubject();
      sessionFeed.publish('run-1', { kind: 'entry', entry: prompt });
      await watch();

      sessionFeed.end('run-1');

      expect(events.at(-1)).toEqual({ kind: 'ended' });
    });

    it('should drop the feed listener when the watcher unsubscribes', async () => {
      const { sessionFeed, watch } = await createWatchSubject();
      sessionFeed.publish('run-1', { kind: 'entry', entry: prompt });
      const unsubscribe = await watch();
      expect(sessionFeed.listenerCount).toBe(1);

      unsubscribe();

      expect(sessionFeed.listenerCount).toBe(0);
    });
  });
});
