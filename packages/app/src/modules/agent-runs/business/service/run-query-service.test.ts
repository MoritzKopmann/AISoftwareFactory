import { describe, expect, it, vi } from 'vitest';
import { TranscriptNotFoundError } from '../errors/transcript-not-found-error.js';
import {
  buildRun,
  FakeCommandLabeler,
  FakeCommandLabelRepository,
  FakeRunRepository,
  FakeRunTranscripts,
  FakeSessionFeed,
} from '../../testing/fake-agent-runs-ports.js';
import type { SessionEntry } from '../domain/types/session-entry.js';
import type { TicketSessionWatchEvent } from '../domain/types/ticket-session-watch.js';
import { CommandLabelService } from './command-label-service.js';
import { RunQueryService } from './run-query-service.js';

function query(
  runRepository: FakeRunRepository,
  runTranscripts = new FakeRunTranscripts(),
): RunQueryService {
  return new RunQueryService({
    runRepository,
    runTranscripts,
    sessionFeed: new FakeSessionFeed(),
    commandLabelService: new CommandLabelService({
      commandLabelRepository: new FakeCommandLabelRepository(),
      commandLabeler: new FakeCommandLabeler(),
    }),
  });
}

describe('RunQueryService', () => {
  describe('readActive', () => {
    it('should return each running run when the project has active runs', async () => {
      const runRepository = new FakeRunRepository();
      const run = buildRun();
      const otherRun = buildRun({ id: 'run-2', ticketNumber: 12 });
      await runRepository.insert(run);
      await runRepository.insert(otherRun);

      const activeRuns = await query(runRepository).readActive('moritz/aisf');

      expect(activeRuns).toEqual([{ run }, { run: otherRun }]);
    });

    it('should return nothing when no run in the project is running', async () => {
      const activeRuns = await query(new FakeRunRepository()).readActive('moritz/aisf');

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

    async function createWatchSubject(
      runOverrides: Parameters<typeof buildRun>[0] | 'none' = {},
      commandLabeler = new FakeCommandLabeler(),
    ) {
      const runRepository = new FakeRunRepository();
      if (runOverrides !== 'none') {
        await runRepository.insert(buildRun({ worktreePath: '/w/repo/7', ...runOverrides }));
      }
      const runTranscripts = new FakeRunTranscripts();
      const sessionFeed = new FakeSessionFeed();
      const subject = new RunQueryService({
        runRepository,
        runTranscripts,
        sessionFeed,
        commandLabelService: new CommandLabelService({
          commandLabelRepository: new FakeCommandLabelRepository(),
          commandLabeler,
        }),
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
        { kind: 'snapshot', entries: [prompt, text, call, result], root: '/w/repo/7' },
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
        { kind: 'snapshot', entries: [prompt, text], root: '/w/repo/7' },
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
        { kind: 'snapshot', entries: [prompt], root: '/w/repo/7' },
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
        { kind: 'snapshot', entries: [prompt, text], root: '/w/repo/7' },
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

    describe('command labels', () => {
      const bash = (toolUseId: string, command: string): SessionEntry => ({
        kind: 'tool-call',
        id: `${toolUseId}#0`,
        toolUseId,
        name: 'Bash',
        input: { command },
      });
      const labelled = (entry: SessionEntry, label: string): SessionEntry =>
        ({ ...entry, label }) as SessionEntry;

      it('should send the label frame between snapshot and ended when a stored session has an unlabelled call', async () => {
        const { runTranscripts, events, watch } = await createWatchSubject(
          { state: 'ended' },
          new FakeCommandLabeler('Runs the tests.'),
        );
        runTranscripts.sessionEntries = [bash('t1', 'npm test')];

        await watch();

        expect(events).toEqual([
          { kind: 'snapshot', entries: [bash('t1', 'npm test')], root: '/w/repo/7' },
          { kind: 'label', toolUseId: 't1', label: 'Runs the tests.' },
          { kind: 'ended' },
        ]);
      });

      it('should use the stored label and call the labeler once when the session is watched twice', async () => {
        const labeler = new FakeCommandLabeler('Runs the tests.');
        const { runTranscripts, events, watch } = await createWatchSubject(
          { state: 'ended' },
          labeler,
        );
        runTranscripts.sessionEntries = [bash('t1', 'npm test')];
        await watch();
        events.length = 0;

        await watch();

        expect(labeler.commands).toEqual(['npm test']);
        expect(events).toEqual([
          {
            kind: 'snapshot',
            entries: [labelled(bash('t1', 'npm test'), 'Runs the tests.')],
            root: '/w/repo/7',
          },
          { kind: 'ended' },
        ]);
      });

      it('should send a label event after the entry when a live Bash call is published', async () => {
        const labeler = new FakeCommandLabeler('Lists files.');
        const { sessionFeed, events, watch } = await createWatchSubject({}, labeler);
        sessionFeed.publish('run-1', { kind: 'entry', entry: prompt });
        await watch();

        sessionFeed.publish('run-1', { kind: 'entry', entry: bash('t2', 'ls') });

        await vi.waitFor(() => expect(events).toHaveLength(3));
        expect(events.slice(1)).toEqual([
          { kind: 'entry', entry: bash('t2', 'ls') },
          { kind: 'label', toolUseId: 't2', label: 'Lists files.' },
        ]);
        expect(labeler.commands).toEqual(['ls']);
      });

      it('should send the pending label before ended when the feed ends', async () => {
        let answer: (label: string) => void = () => undefined;
        const labeler = new FakeCommandLabeler(
          new Promise<string>((resolve) => {
            answer = resolve;
          }),
        );
        const { sessionFeed, events, watch } = await createWatchSubject({}, labeler);
        sessionFeed.publish('run-1', { kind: 'entry', entry: prompt });
        await watch();
        sessionFeed.publish('run-1', { kind: 'entry', entry: bash('t2', 'ls') });
        sessionFeed.end('run-1');
        await Promise.resolve();
        expect(events.map(({ kind }) => kind)).toEqual(['snapshot', 'entry']);

        answer('Lists files.');

        await vi.waitFor(() => expect(events.at(-1)).toEqual({ kind: 'ended' }));
        expect(events.slice(2)).toEqual([
          { kind: 'label', toolUseId: 't2', label: 'Lists files.' },
          { kind: 'ended' },
        ]);
      });

      it('should leave the call unlabelled when the labeler rejects', async () => {
        const { runTranscripts, events, watch } = await createWatchSubject(
          { state: 'ended' },
          new FakeCommandLabeler(new Error('haiku down')),
        );
        runTranscripts.sessionEntries = [bash('t1', 'npm test')];

        await watch();

        expect(events.map(({ kind }) => kind)).toEqual(['snapshot', 'ended']);
      });

      it('should send no further event when the label resolves after unsubscribe', async () => {
        let answer: (label: string) => void = () => undefined;
        const labeler = new FakeCommandLabeler(
          new Promise<string>((resolve) => {
            answer = resolve;
          }),
        );
        const { sessionFeed, events, watch } = await createWatchSubject({}, labeler);
        sessionFeed.publish('run-1', { kind: 'entry', entry: prompt });
        const unsubscribe = await watch();
        sessionFeed.publish('run-1', { kind: 'entry', entry: bash('t2', 'ls') });
        const before = events.length;

        unsubscribe();
        answer('Lists files.');
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(events).toHaveLength(before);
      });
    });
  });
});
