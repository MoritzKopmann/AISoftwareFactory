import { ConflictError } from '../../../../shared/errors.js';
import type { SchedulerApi } from '../../../scheduler/index.js';
import type { SchedulerPort } from '../../business/port/scheduler/scheduler-port.js';
import { PageBusyError } from '../../business/errors/page-busy-error.js';

export class SchedulerAdapter implements SchedulerPort {
  constructor(private readonly scheduler: Pick<SchedulerApi, 'answer'>) {}

  async answer(runId: string, text: string): Promise<void> {
    try {
      await this.scheduler.answer(runId, { kind: 'checkpoint', text });
    } catch (error) {
      if (error instanceof ConflictError) {
        throw new PageBusyError(error.message);
      }
      throw error;
    }
  }
}
