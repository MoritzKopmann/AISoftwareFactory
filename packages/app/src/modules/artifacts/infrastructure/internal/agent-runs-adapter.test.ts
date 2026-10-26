import { describe, expect, it } from 'vitest';
import type { AgentRunsApi } from '../../../agent-runs/index.js';
import { AgentRunsAdapter } from './agent-runs-adapter.js';

type RunDto = NonNullable<Awaited<ReturnType<AgentRunsApi['latestRun']>>>;

describe('AgentRunsAdapter', () => {
  describe('latest', () => {
    it('should carry the worktree path when the latest run has one', async () => {
      const run: RunDto = {
        id: 'r1',
        projectId: 'o/n',
        ticketNumber: 41,
        stage: 'implement',
        mode: 'afk',
        sessionId: 's1',
        worktreePath: '/w/41',
        branchName: 'aisf/41-x',
        state: 'running',
        answerHeld: false,
        startedAt: '2026-10-06T10:00:00.000Z',
      };
      const adapter = new AgentRunsAdapter({ latestRun: async () => run });

      const latest = await adapter.latest('o/n', 41);

      expect(latest?.worktreePath).toBe('/w/41');
    });
  });
});
