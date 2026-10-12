import { describe, expect, it } from 'vitest';
import { SchedulerModuleCheckpointAnswers } from '../../../../../src/modules/artifacts/infra/integrations/scheduler-module-checkpoint-answers.js';
import { PageBusyError } from '../../../../../src/modules/artifacts/logic/errors/page-busy-error.js';
import {
  RunAlreadyActiveError,
  RunNotAnswerableError,
} from '../../../../../src/modules/scheduler/index.js';
import { FakeSchedulerAnswer } from '../../fakes/fake-scheduler-answer.js';

describe('SchedulerModuleCheckpointAnswers', () => {
  describe('answer', () => {
    it('should send the text as a checkpoint answer when the scheduler accepts it', async () => {
      const scheduler = new FakeSchedulerAnswer();
      const checkpointAnswers = new SchedulerModuleCheckpointAnswers(() => scheduler);

      await checkpointAnswers.answer('run-1', 'ok');

      expect(scheduler.calls).toEqual([
        { runId: 'run-1', answer: { kind: 'checkpoint', text: 'ok' } },
      ]);
    });

    it('should throw PageBusyError when the scheduler refuses with RunNotAnswerableError', async () => {
      const scheduler = new FakeSchedulerAnswer();
      scheduler.failure = new RunNotAnswerableError('not answerable');
      const checkpointAnswers = new SchedulerModuleCheckpointAnswers(() => scheduler);

      await expect(checkpointAnswers.answer('run-1', 'ok')).rejects.toThrow(PageBusyError);
    });

    it('should throw PageBusyError when the scheduler refuses with RunAlreadyActiveError', async () => {
      const scheduler = new FakeSchedulerAnswer();
      scheduler.failure = new RunAlreadyActiveError('active');
      const checkpointAnswers = new SchedulerModuleCheckpointAnswers(() => scheduler);

      await expect(checkpointAnswers.answer('run-1', 'ok')).rejects.toThrow(PageBusyError);
    });

    it('should rethrow the error when the scheduler fails with another error', async () => {
      const scheduler = new FakeSchedulerAnswer();
      const failure = new Error('boom');
      scheduler.failure = failure;
      const checkpointAnswers = new SchedulerModuleCheckpointAnswers(() => scheduler);

      await expect(checkpointAnswers.answer('run-1', 'ok')).rejects.toBe(failure);
    });
  });
});
