import { PageBusyError } from '../../logic/errors/page-busy-error.js';
import type { CheckpointAnswers } from '../../logic/ports/checkpoint-answers.js';
import {
  RunAlreadyActiveError,
  RunNotAnswerableError,
  type SchedulerModule,
} from '../../../scheduler/index.js';

export class SchedulerModuleCheckpointAnswers implements CheckpointAnswers {
  constructor(private readonly scheduler: () => Pick<SchedulerModule, 'answer'>) {}

  async answer(runId: string, text: string): Promise<void> {
    try {
      await this.scheduler().answer(runId, { kind: 'checkpoint', text });
    } catch (error) {
      if (error instanceof RunNotAnswerableError || error instanceof RunAlreadyActiveError) {
        throw new PageBusyError(error.message);
      }
      throw error;
    }
  }
}
