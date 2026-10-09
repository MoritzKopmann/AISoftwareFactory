import type { RunWaitOutcome } from '../../../../../src/modules/runner/logic/domain/types/run-wait-outcome.js';
import type { Run } from '../../../../../src/modules/runner/logic/domain/types/run.js';
import type { RunWait } from '../../../../../src/modules/runner/logic/domain/types/run-wait.js';
import { describe, expect, it, vi } from 'vitest';
import { LaunchRunSessionUseCase } from '../../../../../src/modules/runner/logic/use-cases/launch-run-session-use-case.js';
import type { FinishRun } from '../../../../../src/modules/runner/logic/domain/types/finish-run.js';
import type { RunTool } from '../../../../../src/modules/runner/logic/domain/types/run-tool.js';
import { FakeEventPublisher } from '../../../../fakes/fake-event-publisher.js';
import {
  buildRun,
  FakeAgentSessions,
  FakeRecentRunSteps,
  FakeRunRepository,
} from '../../fakes/fake-runner-ports.js';

function buildSubject(
  tools: ReadonlyArray<RunTool> = [],
  outcome: RunWaitOutcome = {
    kind: 'answered',
    answer: { kind: 'checkpoint', text: 'the answer' },
  },
  waitOverride?: (run: Run, wait: RunWait) => Promise<RunWaitOutcome>,
) {
  const agentSessions = new FakeAgentSessions();
  const runRepository = new FakeRunRepository();
  const finishedEndings: Array<Parameters<FinishRun>[1]> = [];
  const waitedFor: string[] = [];
  const waits: RunWait[] = [];
  const useCase = new LaunchRunSessionUseCase({
    agentSessions,
    recentRunSteps: new FakeRecentRunSteps(),
    runRepository,
    finishRun: async (_runId, ending) => {
      finishedEndings.push(ending);
    },
    waitForRunAnswer: async (run, wait) => {
      waits.push(wait);
      if (waitOverride !== undefined) {
        return waitOverride(run, wait);
      }
      waitedFor.push(wait.kind === 'checkpoint' ? wait.request : wait.toolName);
      return outcome;
    },
    tools,
    events: new FakeEventPublisher(),
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  });
  return { useCase, agentSessions, runRepository, finishedEndings, waitedFor, waits };
}

describe('LaunchRunSessionUseCase', () => {
  describe('execute', () => {
    it('should start the session with the run session, worktree, prompt and stage model when the launch is a start', () => {
      const { useCase, agentSessions } = buildSubject();

      useCase.execute(buildRun(), { kind: 'start', prompt: '/aisf:implement-ticket 137' });

      expect(agentSessions.resumedSpecs).toEqual([]);
      expect(agentSessions.startedSpecs).toHaveLength(1);
      expect(agentSessions.startedSpecs[0]).toMatchObject({
        sessionId: 'session-1',
        worktreePath: '/worktrees/aisf/137',
        prompt: '/aisf:implement-ticket 137',
        model: 'sonnet',
      });
    });

    it('should resume the session with the allowed call when the launch is a resume with one', () => {
      const { useCase, agentSessions } = buildSubject();
      const allowedCall = { toolName: 'Bash', toolInput: { command: 'git push' } };

      useCase.execute(buildRun(), { kind: 'resume', prompt: 'carry on', allowedCall });

      expect(agentSessions.startedSpecs).toEqual([]);
      expect(agentSessions.resumedSpecs[0]).toMatchObject({
        sessionId: 'session-1',
        prompt: 'carry on',
        allowedCall,
      });
    });

    it('should resume the session without an allowed call when the launch is a resume without one', () => {
      const { useCase, agentSessions } = buildSubject();

      useCase.execute(buildRun(), { kind: 'resume', prompt: 'carry on' });

      expect(agentSessions.resumedSpecs).toHaveLength(1);
      expect(agentSessions.resumedSpecs[0]).not.toHaveProperty('allowedCall');
    });
  });

  describe('bound tools', () => {
    function buildTool(result: Awaited<ReturnType<RunTool['execute']>>) {
      const executions: unknown[] = [];
      const tool: RunTool = {
        name: 'aisf_example',
        description: 'Example',
        inputShape: {},
        execute: async (input) => {
          executions.push(input);
          return result;
        },
      };
      return { tool, executions };
    }

    async function callBoundTool(subject: ReturnType<typeof buildSubject>, run = buildRun()) {
      await subject.runRepository.insert(run);
      subject.useCase.execute(run, { kind: 'start', prompt: 'go' });
      const [boundTool] = subject.agentSessions.startedSpecs[0]?.tools ?? [];
      return boundTool?.execute({ any: 'input' });
    }

    it('should return the tool text and finish the run when the result carries an ending', async () => {
      const { tool } = buildTool({ text: 'done', ending: { kind: 'finished' } });
      const subject = buildSubject([tool]);

      expect(await callBoundTool(subject)).toBe('done');
      expect(subject.finishedEndings).toEqual([{ kind: 'finished' }]);
    });

    it('should hand the wait to the wait use case and return its answer when the result is a wait', async () => {
      const { tool } = buildTool({ wait: { kind: 'checkpoint', request: 'Check' } });
      const subject = buildSubject([tool]);

      expect(await callBoundTool(subject)).toBe('the answer');
      expect(subject.waitedFor).toEqual(['Check']);
      expect(subject.finishedEndings).toEqual([]);
    });

    it('should return the unanswered message when the wait is unanswered', async () => {
      const { tool } = buildTool({ wait: { kind: 'checkpoint', request: 'Check' } });
      const subject = buildSubject([tool], {
        kind: 'unanswered',
        message: 'The run has ended. End your turn.',
      });

      expect(await callBoundTool(subject)).toBe('The run has ended. End your turn.');
    });

    it('should refuse and run nothing when the run is no longer running', async () => {
      const { tool, executions } = buildTool({ text: 'done', ending: { kind: 'finished' } });
      const subject = buildSubject([tool]);

      const text = await callBoundTool(
        subject,
        buildRun({ state: 'ended', ending: { kind: 'stopped' } }),
      );

      expect(text).toContain('has ended');
      expect(executions).toEqual([]);
      expect(subject.finishedEndings).toEqual([]);
      expect(subject.waitedFor).toEqual([]);
    });
  });

  describe('bound permission decision', () => {
    const dateCall = { toolName: 'Bash', toolInput: { command: 'date' } };
    const allowOutcome: RunWaitOutcome = {
      kind: 'answered',
      answer: { kind: 'permission', decision: 'allow' },
    };
    const denyOutcome: RunWaitOutcome = {
      kind: 'answered',
      answer: { kind: 'permission', decision: 'deny' },
    };
    const refusal = 'A human refused this tool call. Do not retry it; carry on without it.';

    function launch(subject: ReturnType<typeof buildSubject>, kind: 'start' | 'resume' = 'start') {
      subject.useCase.execute(buildRun(), { kind, prompt: 'go' });
      const spec = (
        kind === 'start' ? subject.agentSessions.startedSpecs : subject.agentSessions.resumedSpecs
      )[0];
      if (spec === undefined) {
        throw new Error('no spec');
      }
      return spec;
    }

    it('should wait on the permission and return allow when the answer is allow', async () => {
      const subject = buildSubject([], allowOutcome);

      const verdict = await launch(subject).decidePermission(dateCall);

      expect(verdict).toEqual({ kind: 'allow' });
      expect(subject.waits).toEqual([{ kind: 'permission-needed', ...dateCall }]);
    });

    it('should pass the reason into the permission wait when the request has one', async () => {
      const subject = buildSubject([], allowOutcome);
      const request = { ...dateCall, reason: 'Posting to GitHub is hard-denied' };

      await launch(subject).decidePermission(request);

      expect(subject.waits).toEqual([{ kind: 'permission-needed', ...request }]);
    });

    it('should return the same verdict for a resume launch when the answer is allow', async () => {
      const subject = buildSubject([], allowOutcome);

      expect(await launch(subject, 'resume').decidePermission(dateCall)).toEqual({ kind: 'allow' });
    });

    it('should return a refusing deny when the answer is deny', async () => {
      const subject = buildSubject([], denyOutcome);

      expect(await launch(subject).decidePermission(dateCall)).toEqual({
        kind: 'deny',
        message: refusal,
      });
    });

    it('should return a deny with the wait message when the wait is unanswered', async () => {
      const subject = buildSubject([], {
        kind: 'unanswered',
        message: 'The run has ended. End your turn.',
      });

      expect(await launch(subject).decidePermission(dateCall)).toEqual({
        kind: 'deny',
        message: 'The run has ended. End your turn.',
      });
    });

    it('should start the second wait only after the first settles when two calls are decided together', async () => {
      const settlers: Array<(outcome: RunWaitOutcome) => void> = [];
      const subject = buildSubject(
        [],
        allowOutcome,
        () => new Promise((resolve) => settlers.push(resolve)),
      );
      const spec = launch(subject);
      const unameCall = { toolName: 'Bash', toolInput: { command: 'uname' } };

      const dateVerdict = spec.decidePermission(dateCall);
      const unameVerdict = spec.decidePermission(unameCall);
      await vi.waitFor(() => expect(subject.waits).toHaveLength(1));
      await Promise.resolve();

      expect(subject.waits).toEqual([{ kind: 'permission-needed', ...dateCall }]);
      settlers[0]?.(allowOutcome);
      expect(await dateVerdict).toEqual({ kind: 'allow' });
      await vi.waitFor(() => expect(settlers).toHaveLength(2));
      expect(subject.waits[1]).toEqual({ kind: 'permission-needed', ...unameCall });
      settlers[1]?.(denyOutcome);
      expect(await unameVerdict).toEqual({ kind: 'deny', message: refusal });
    });

    it('should start the queued wait when the earlier wait ends unanswered', async () => {
      const outcomes: RunWaitOutcome[] = [
        { kind: 'unanswered', message: 'The run has ended. End your turn.' },
        allowOutcome,
      ];
      const subject = buildSubject([], allowOutcome, async () => outcomes.shift() ?? allowOutcome);
      const spec = launch(subject);

      const earlierVerdict = spec.decidePermission(dateCall);
      const queuedVerdict = spec.decidePermission(dateCall);

      expect(await earlierVerdict).toEqual({
        kind: 'deny',
        message: 'The run has ended. End your turn.',
      });
      expect(await queuedVerdict).toEqual({ kind: 'allow' });
    });

    it('should keep one queue per launch when two launches decide permissions', async () => {
      const subject = buildSubject([], allowOutcome, () => new Promise(() => undefined));
      const startSpec = launch(subject);
      subject.useCase.execute(buildRun(), { kind: 'resume', prompt: 'go' });
      const resumeSpec = subject.agentSessions.resumedSpecs[0];

      void startSpec.decidePermission(dateCall);
      void resumeSpec?.decidePermission(dateCall);

      await vi.waitFor(() => expect(subject.waits).toHaveLength(2));
    });
  });
});
