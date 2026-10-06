import type { CheckpointAnswers } from '../../../../src/modules/bridge/logic/ports/checkpoint-answers.js';

export class FakeCheckpointAnswers implements CheckpointAnswers {
  readonly calls: Array<{ runId: string; text: string }> = [];
  failure: Error | undefined;

  async answer(runId: string, text: string): Promise<void> {
    if (this.failure !== undefined) {
      throw this.failure;
    }
    this.calls.push({ runId, text });
  }
}
