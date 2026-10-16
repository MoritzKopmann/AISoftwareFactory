import { describe, expect, it } from 'vitest';
import { RunAlreadyActiveError } from '../../business/errors/run-already-active-error.js';
import { RunNotAnswerableError } from '../../business/errors/run-not-answerable-error.js';
import { FakeRunnerApi, buildRunDto } from '../../testing/fake-scheduler-apis.js';
import { RunnerRunnerPort } from './runner-runner-port.js';

const request = {
  projectId: 'moritz/aisf',
  ticketNumber: 138,
  ticketTitle: 'Add login',
  status: 'ready' as const,
  types: [],
};

describe('RunnerRunnerPort', () => {
  describe('start', () => {
    it('should return the started run when the runner starts it', async () => {
      const port = new RunnerRunnerPort(new FakeRunnerApi());

      expect(await port.start(request)).toMatchObject({ id: 'run-1' });
    });

    it('should throw RunAlreadyActiveError when the runner reports a run already active', async () => {
      const runner = new FakeRunnerApi();
      runner.startResult = { kind: 'already-active', message: 'busy' };

      await expect(new RunnerRunnerPort(runner).start(request)).rejects.toThrow(
        new RunAlreadyActiveError('busy'),
      );
    });
  });

  describe('answer', () => {
    it('should return the resumed run when the runner answers it', async () => {
      const port = new RunnerRunnerPort(new FakeRunnerApi());

      expect(await port.answer('r1', { kind: 'checkpoint', text: 'A' })).toMatchObject({
        id: 'run-2',
      });
    });

    it('should throw RunAlreadyActiveError when the runner reports a run already active', async () => {
      const runner = new FakeRunnerApi();
      runner.answerResult = { kind: 'already-active', message: 'busy' };

      await expect(
        new RunnerRunnerPort(runner).answer('r1', { kind: 'checkpoint', text: 'A' }),
      ).rejects.toThrow(RunAlreadyActiveError);
    });

    it('should throw RunNotAnswerableError when the runner finds the run not resumable', async () => {
      const runner = new FakeRunnerApi();
      runner.answerResult = { kind: 'not-resumable', message: 'gone' };

      await expect(
        new RunnerRunnerPort(runner).answer('r1', { kind: 'checkpoint', text: 'A' }),
      ).rejects.toThrow(new RunNotAnswerableError('gone'));
    });
  });

  it('should return the run record when the runner finds the run', async () => {
    const runner = new FakeRunnerApi();
    runner.record = buildRunDto({ id: 'r1' });

    expect(await new RunnerRunnerPort(runner).findRun('r1')).toMatchObject({ id: 'r1' });
  });
});
