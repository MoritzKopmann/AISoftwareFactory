import { describe, expect, it } from 'vitest';
import { RunAlreadyActiveError } from '../../business/errors/run-already-active-error.js';
import { RunNotAnswerableError } from '../../business/errors/run-not-answerable-error.js';
import { FakeAgentRunsApi, buildRunDto } from '../../testing/fake-scheduler-apis.js';
import { AgentRunsAgentRunControl } from './agent-runs-agent-run-control.js';

const request = {
  projectId: 'moritz/aisf',
  ticketNumber: 138,
  ticketTitle: 'Add login',
  status: 'ready' as const,
  types: [],
};

describe('AgentRunsAgentRunControl', () => {
  describe('start', () => {
    it('should return the started run when agent runs starts it', async () => {
      const port = new AgentRunsAgentRunControl(new FakeAgentRunsApi());

      expect(await port.start(request)).toMatchObject({ id: 'run-1' });
    });

    it('should throw RunAlreadyActiveError when agent runs reports a run already active', async () => {
      const agentRuns = new FakeAgentRunsApi();
      agentRuns.startResult = { kind: 'already-active', message: 'busy' };

      await expect(new AgentRunsAgentRunControl(agentRuns).start(request)).rejects.toThrow(
        new RunAlreadyActiveError('busy'),
      );
    });
  });

  describe('answer', () => {
    it('should return the resumed run when agent runs answers it', async () => {
      const port = new AgentRunsAgentRunControl(new FakeAgentRunsApi());

      expect(await port.answer('r1', { kind: 'checkpoint', text: 'A' })).toMatchObject({
        id: 'run-2',
      });
    });

    it('should throw RunAlreadyActiveError when agent runs reports a run already active', async () => {
      const agentRuns = new FakeAgentRunsApi();
      agentRuns.answerResult = { kind: 'already-active', message: 'busy' };

      await expect(
        new AgentRunsAgentRunControl(agentRuns).answer('r1', { kind: 'checkpoint', text: 'A' }),
      ).rejects.toThrow(RunAlreadyActiveError);
    });

    it('should throw RunNotAnswerableError when agent runs finds the run not resumable', async () => {
      const agentRuns = new FakeAgentRunsApi();
      agentRuns.answerResult = { kind: 'not-resumable', message: 'gone' };

      await expect(
        new AgentRunsAgentRunControl(agentRuns).answer('r1', { kind: 'checkpoint', text: 'A' }),
      ).rejects.toThrow(new RunNotAnswerableError('gone'));
    });
  });

  it('should return the run record when agent runs finds the run', async () => {
    const agentRuns = new FakeAgentRunsApi();
    agentRuns.record = buildRunDto({ id: 'r1' });

    expect(await new AgentRunsAgentRunControl(agentRuns).findRun('r1')).toMatchObject({ id: 'r1' });
  });
});
