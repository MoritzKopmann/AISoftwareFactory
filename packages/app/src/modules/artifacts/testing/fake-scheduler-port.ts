import type { SchedulerPort } from '../business/port/scheduler/scheduler-port.js';

export class FakeSchedulerPort implements SchedulerPort {
  readonly calls: Array<{ runId: string; text: string }> = [];
  failure: Error | undefined;

  async answer(runId: string, text: string): Promise<void> {
    if (this.failure !== undefined) {
      throw this.failure;
    }
    this.calls.push({ runId, text });
  }
}
