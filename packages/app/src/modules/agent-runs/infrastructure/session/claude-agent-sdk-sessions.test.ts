import { describe, expect, it } from 'vitest';
import { ClaudeAgentSdkSessions } from './claude-agent-sdk-sessions.js';

describe('ClaudeAgentSdkSessions', () => {
  it('should yield generating on first when a session starts, before any SDK message', async () => {
    const sessions = new ClaudeAgentSdkSessions({
      claudeExecutablePath: '/nonexistent/claude',
      pluginDirectory: '/nonexistent/plugin',
      answerTimeoutMilliseconds: 1,
    });
    const stream = sessions.start({
      sessionId: 's1',
      worktreePath: '/nonexistent',
      prompt: 'hi',
      model: 'm',
      tools: [],
      decidePermission: async () => ({ kind: 'allow' }),
    });
    const iterator = stream[Symbol.asyncIterator]();

    const first = await iterator.next();
    await iterator.return?.();

    expect(first.value).toEqual({ kind: 'generating', active: true });
  });
});
