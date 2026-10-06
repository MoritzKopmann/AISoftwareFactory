import { describe, expect, it, vi } from 'vitest';
import { LaunchRunSessionUseCase } from '../../../../../src/modules/runner/logic/use-cases/launch-run-session-use-case.js';
import type { FinishRun } from '../../../../../src/modules/runner/logic/domain/types/finish-run.js';
import type { RunTool } from '../../../../../src/modules/runner/logic/domain/types/run-tool.js';
import {
  buildRun,
  FakeAgentSessions,
  FakeRecentRunSteps,
  FakeRunRepository,
} from '../../fakes/fake-runner-ports.js';

function buildSubject(tools: ReadonlyArray<RunTool> = []) {
  const agentSessions = new FakeAgentSessions();
  const runRepository = new FakeRunRepository();
  const finishedEndings: Array<Parameters<FinishRun>[1]> = [];
  const waitedFor: string[] = [];
  const useCase = new LaunchRunSessionUseCase({
    agentSessions,
    recentRunSteps: new FakeRecentRunSteps(),
    runRepository,
    finishRun: async (_runId, ending) => {
      finishedEndings.push(ending);
    },
    waitForRunAnswer: async (_run, wait) => {
      waitedFor.push(wait.request);
      return 'the answer';
    },
    tools,
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  });
  return { useCase, agentSessions, runRepository, finishedEndings, waitedFor };
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
});
