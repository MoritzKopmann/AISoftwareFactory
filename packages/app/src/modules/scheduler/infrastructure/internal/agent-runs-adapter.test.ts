import { describe, expect, it } from 'vitest';
import { RunAlreadyActiveError } from '../../business/errors/run-already-active-error.js';
import { RunNotAnswerableError } from '../../business/errors/run-not-answerable-error.js';
import { FakeAgentRunsApi, buildRunDto } from '../../testing/fake-scheduler-apis.js';
import { AgentRunsAdapter } from './agent-runs-adapter.js';

const request = {
  projectId: 'moritz/aisf',
  ticketNumber: 138,
  ticketTitle: 'Add login',
  status: 'ready' as const,
  types: [],
};

describe('AgentRunsAdapter', () => {
  describe('start', () => {
    it('should return the started run when agent runs starts it', async () => {
      const port = new AgentRunsAdapter(new FakeAgentRunsApi());

      expect(await port.start(request)).toMatchObject({ id: 'run-1' });
    });

    it('should throw RunAlreadyActiveError when agent runs reports a run already active', async () => {
      const agentRuns = new FakeAgentRunsApi();
      agentRuns.startResult = { kind: 'already-active', message: 'busy' };

      await expect(new AgentRunsAdapter(agentRuns).start(request)).rejects.toThrow(
        new RunAlreadyActiveError('busy'),
      );
    });
  });

  describe('answer', () => {
    it('should return the resumed run when agent runs answers it', async () => {
      const port = new AgentRunsAdapter(new FakeAgentRunsApi());

      expect(await port.answer('r1', { kind: 'checkpoint', text: 'A' })).toMatchObject({
        id: 'run-2',
      });
    });

    it('should throw RunAlreadyActiveError when agent runs reports a run already active', async () => {
      const agentRuns = new FakeAgentRunsApi();
      agentRuns.answerResult = { kind: 'already-active', message: 'busy' };

      await expect(
        new AgentRunsAdapter(agentRuns).answer('r1', { kind: 'checkpoint', text: 'A' }),
      ).rejects.toThrow(RunAlreadyActiveError);
    });

    it('should throw RunNotAnswerableError when agent runs finds the run not resumable', async () => {
      const agentRuns = new FakeAgentRunsApi();
      agentRuns.answerResult = { kind: 'not-resumable', message: 'gone' };

      await expect(
        new AgentRunsAdapter(agentRuns).answer('r1', { kind: 'checkpoint', text: 'A' }),
      ).rejects.toThrow(new RunNotAnswerableError('gone'));
    });
  });

  describe('pausedRuns', () => {
    it('should carry the held answer when the paused run has one', async () => {
      const agentRuns = new FakeAgentRunsApi();
      agentRuns.paused = [
        { runId: 'run-1', ticketNumber: 7, heldAnswer: { kind: 'checkpoint', text: 'yes' } },
      ];

      expect(await new AgentRunsAdapter(agentRuns).pausedRuns('owner/name')).toEqual([
        { runId: 'run-1', ticketNumber: 7, heldAnswer: { kind: 'checkpoint', text: 'yes' } },
      ]);
    });

    it('should leave the held answer out when the paused run has none', async () => {
      const agentRuns = new FakeAgentRunsApi();
      agentRuns.paused = [{ runId: 'run-1', ticketNumber: 7, heldAnswer: null }];

      const [run] = await new AgentRunsAdapter(agentRuns).pausedRuns('owner/name');

      expect(run).toEqual({ runId: 'run-1', ticketNumber: 7 });
      expect(run).not.toHaveProperty('heldAnswer');
    });
  });

  describe('holdAnswer', () => {
    it('should hand the answer to agent runs when an answer is held', async () => {
      const agentRuns = new FakeAgentRunsApi();

      await new AgentRunsAdapter(agentRuns).holdAnswer('run-1', {
        kind: 'permission',
        decision: 'allow',
      });

      expect(agentRuns.calls).toEqual([
        'holdAnswer run-1 {"kind":"permission","decision":"allow"}',
      ]);
    });
  });

  describe('resumePaused', () => {
    it('should return the started run when agent runs resumes it', async () => {
      const port = new AgentRunsAdapter(new FakeAgentRunsApi());

      expect(await port.resumePaused('run-1')).toMatchObject({ id: 'run-2' });
    });

    it('should throw RunAlreadyActiveError when agent runs reports a run already active', async () => {
      const agentRuns = new FakeAgentRunsApi();
      agentRuns.resumeResult = { kind: 'already-active', message: 'busy' };

      await expect(new AgentRunsAdapter(agentRuns).resumePaused('run-1')).rejects.toThrow(
        RunAlreadyActiveError,
      );
    });

    it('should throw RunNotAnswerableError when agent runs finds the run not resumable', async () => {
      const agentRuns = new FakeAgentRunsApi();
      agentRuns.resumeResult = { kind: 'not-resumable', message: 'gone' };

      await expect(new AgentRunsAdapter(agentRuns).resumePaused('run-1')).rejects.toThrow(
        RunNotAnswerableError,
      );
    });
  });

  it('should report the answer held when the latest run has one held', async () => {
    const agentRuns = new FakeAgentRunsApi();
    agentRuns.latest = buildRunDto({ answerHeld: true });

    const latest = await new AgentRunsAdapter(agentRuns).latestRun('owner/name', 7);

    expect(latest?.answerHeld).toBe(true);
  });

  it('should report the answer held when an active run has one held', async () => {
    const agentRuns = new FakeAgentRunsApi();
    agentRuns.activeRunDtos = [buildRunDto({ ticketNumber: 7, answerHeld: true })];

    const [active] = await new AgentRunsAdapter(agentRuns).activeRuns('owner/name');

    expect(active?.run.answerHeld).toBe(true);
  });

  it('should return the run record when agent runs finds the run', async () => {
    const agentRuns = new FakeAgentRunsApi();
    agentRuns.record = buildRunDto({ id: 'r1' });

    expect(await new AgentRunsAdapter(agentRuns).findRun('r1')).toMatchObject({ id: 'r1' });
  });
});
