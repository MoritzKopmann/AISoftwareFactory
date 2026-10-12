import type { SchedulerModule } from '../../../../src/modules/scheduler/index.js';

export class FakeSchedulerAnswer implements Pick<SchedulerModule, 'answer'> {
  readonly calls: Array<{ runId: string; answer: Parameters<SchedulerModule['answer']>[1] }> = [];
  failure: Error | undefined;

  async answer(
    runId: string,
    answer: Parameters<SchedulerModule['answer']>[1],
  ): ReturnType<SchedulerModule['answer']> {
    this.calls.push({ runId, answer });
    if (this.failure !== undefined) {
      throw this.failure;
    }
    return { id: runId, startedAt: '2026-10-12T00:00:00.000Z' };
  }
}
