import { ConflictError } from '../../../../shared/errors.js';
import type { TicketRunService } from '../../business/service/ticket-run-service.js';
import type { RunAnswerDto } from '../dto/internal/run-answer-dto.js';
import type { RunAnswerResultDto } from '../dto/internal/run-answer-result-dto.js';
import { toRunAnswer, toRunAnswerResultDto } from '../dto/mapper/run-mapper.js';
import type { SchedulerApi } from './scheduler-api.js';

export type SchedulerFacadeServices = {
  readonly ticketRunService: TicketRunService;
};

export class SchedulerFacade implements SchedulerApi {
  constructor(private readonly services: SchedulerFacadeServices) {}

  async answer(runId: string, answer: RunAnswerDto): Promise<RunAnswerResultDto> {
    try {
      return toRunAnswerResultDto(
        await this.services.ticketRunService.answer(runId, toRunAnswer(answer)),
      );
    } catch (error) {
      // Only the shared kind leaves the module, never a scheduler error type.
      if (error instanceof ConflictError) {
        throw new ConflictError(error.message);
      }
      throw error;
    }
  }
}
