import { describe, expect, it, vi } from 'vitest';
import { LaunchRunSessionUseCase } from '../../../../../src/modules/runner/logic/use-cases/launch-run-session-use-case.js';
import { buildRun, FakeAgentSessions, FakeRecentRunSteps } from '../../fakes/fake-runner-ports.js';

function buildSubject() {
  const agentSessions = new FakeAgentSessions();
  const useCase = new LaunchRunSessionUseCase({
    agentSessions,
    recentRunSteps: new FakeRecentRunSteps(),
    finishRun: async () => undefined,
    tools: [],
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  });
  return { useCase, agentSessions };
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
});
