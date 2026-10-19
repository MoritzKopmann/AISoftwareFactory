import { beforeEach, describe, expect, it } from 'vitest';
import { RunNotResumableError } from '../errors/run-not-resumable-error.js';
import { RunAnswerService } from './run-answer-service.js';
import type { RunAnswer } from '../domain/types/run-answer.js';
import type { Run } from '../domain/types/run.js';
import {
  buildRun,
  FakeRunAnswerWaits,
  FakeRunRepository,
} from '../../testing/fake-agent-runs-ports.js';

describe('RunAnswerService', () => {
  let runRepository: FakeRunRepository;
  let runAnswerWaits: FakeRunAnswerWaits;
  let resumedAnswers: Array<{ runId: string; answer: RunAnswer }>;
  let runAnswerService: RunAnswerService;
  const resumedRun = buildRun({ id: 'run-2' });

  beforeEach(() => {
    runRepository = new FakeRunRepository();
    runAnswerWaits = new FakeRunAnswerWaits();
    resumedAnswers = [];
    runAnswerService = new RunAnswerService({
      runRepository,
      runAnswerWaits,
      runStartService: {
        resume: async (runId, answer): Promise<Run> => {
          resumedAnswers.push({ runId, answer });
          return resumedRun;
        },
      },
    });
  });

  it('should deliver to the live wait and return the waiting run when a checkpoint answer meets one', async () => {
    const waitingRun = buildRun({ waitingFor: { kind: 'checkpoint', request: 'Check' } });
    await runRepository.insert(waitingRun);
    const outcome = runAnswerWaits.wait('run-1', 1000);

    const run = await runAnswerService.deliverAnswer('run-1', {
      kind: 'checkpoint',
      text: 'Looks good',
    });

    expect(run).toEqual(waitingRun);
    expect(await outcome).toEqual({
      kind: 'answered',
      answer: { kind: 'checkpoint', text: 'Looks good' },
    });
    expect(resumedAnswers).toEqual([]);
  });

  it('should resume the run when a checkpoint answer finds no live wait', async () => {
    const answer = { kind: 'checkpoint', text: 'Looks good' } as const;

    const run = await runAnswerService.deliverAnswer('run-1', answer);

    expect(run).toBe(resumedRun);
    expect(resumedAnswers).toEqual([{ runId: 'run-1', answer }]);
  });

  it('should deliver to a live permission wait and not resume when a permission answer meets one', async () => {
    const waitingRun = buildRun({
      waitingFor: { kind: 'permission-needed', toolName: 'Bash', toolInput: { command: 'ls' } },
    });
    await runRepository.insert(waitingRun);
    const outcome = runAnswerWaits.wait('run-1', 1000);
    const answer = { kind: 'permission', decision: 'allow' } as const;

    const run = await runAnswerService.deliverAnswer('run-1', answer);

    expect(run).toEqual(waitingRun);
    expect(await outcome).toEqual({ kind: 'answered', answer });
    expect(resumedAnswers).toEqual([]);
  });

  it('should resume the run when the answer does not fit the live wait', async () => {
    await runRepository.insert(buildRun({ waitingFor: { kind: 'checkpoint', request: 'Check' } }));
    runAnswerWaits.wait('run-1', 1000);
    const answer = { kind: 'permission', decision: 'allow' } as const;

    const run = await runAnswerService.deliverAnswer('run-1', answer);

    expect(run).toBe(resumedRun);
    expect(runAnswerWaits.isWaiting('run-1')).toBe(true);
    expect(resumedAnswers).toEqual([{ runId: 'run-1', answer }]);
  });

  it('should resume the run when the run has ended with a permission ending', async () => {
    await runRepository.insert(
      buildRun({
        state: 'ended',
        ending: { kind: 'permission-needed', toolName: 'Bash', toolInput: { command: 'ls' } },
      }),
    );
    const answer = { kind: 'permission', decision: 'allow' } as const;

    const run = await runAnswerService.deliverAnswer('run-1', answer);

    expect(run).toBe(resumedRun);
    expect(resumedAnswers).toEqual([{ runId: 'run-1', answer }]);
  });
  describe('holdAnswer', () => {
    const permissionNeeded = {
      kind: 'permission-needed',
      toolName: 'Bash',
      toolInput: { command: 'ls' },
    } as const;
    const allow = { kind: 'permission', decision: 'allow' } as const;
    const yes = { kind: 'checkpoint', text: 'yes' } as const;

    it('should hold the answer and start nothing when the run ended permission-needed', async () => {
      await runRepository.insert(buildRun({ state: 'ended', ending: permissionNeeded }));

      await runAnswerService.holdAnswer('run-1', allow);

      expect(runRepository.runs.get('run-1')?.heldAnswer).toEqual(allow);
      expect(runRepository.runs.size).toBe(1);
      expect(resumedAnswers).toEqual([]);
    });

    it('should hold the answer and not deliver it when the run waits for it', async () => {
      await runRepository.insert(
        buildRun({ waitingFor: { kind: 'checkpoint', request: 'Check' } }),
      );
      runAnswerWaits.wait('run-1', 1000);

      await runAnswerService.holdAnswer('run-1', yes);

      expect(runRepository.runs.get('run-1')?.heldAnswer).toEqual(yes);
      expect(runAnswerWaits.isWaiting('run-1')).toBe(true);
    });

    it('should throw RunNotResumableError when the run is unknown', async () => {
      await expect(runAnswerService.holdAnswer('r9', yes)).rejects.toThrow(RunNotResumableError);
    });

    it('should throw RunNotResumableError and hold nothing when the answer does not fit the ending', async () => {
      await runRepository.insert(
        buildRun({ state: 'ended', ending: { kind: 'checkpoint', request: 'Check' } }),
      );

      await expect(runAnswerService.holdAnswer('run-1', allow)).rejects.toThrow(
        RunNotResumableError,
      );

      expect(runRepository.runs.get('run-1')?.heldAnswer).toBeUndefined();
    });

    it('should throw RunNotResumableError when the run ended usage-limit', async () => {
      await runRepository.insert(
        buildRun({ state: 'ended', ending: { kind: 'usage-limit', reason: 'limit' } }),
      );

      await expect(runAnswerService.holdAnswer('run-1', yes)).rejects.toThrow(RunNotResumableError);
    });

    it('should replace the held answer when a second answer is held', async () => {
      await runRepository.insert(
        buildRun({
          state: 'ended',
          ending: { kind: 'checkpoint', request: 'Check' },
          heldAnswer: yes,
        }),
      );

      await runAnswerService.holdAnswer('run-1', { kind: 'checkpoint', text: 'no' });

      expect(runRepository.runs.get('run-1')?.heldAnswer).toEqual({
        kind: 'checkpoint',
        text: 'no',
      });
    });

    it('should clear the held answer when deliverAnswer resumes the run', async () => {
      await runRepository.insert(
        buildRun({
          state: 'ended',
          ending: { kind: 'checkpoint', request: 'Check' },
          heldAnswer: yes,
        }),
      );

      await runAnswerService.deliverAnswer('run-1', yes);

      expect(runRepository.runs.get('run-1')?.heldAnswer).toBeUndefined();
    });
  });
});
