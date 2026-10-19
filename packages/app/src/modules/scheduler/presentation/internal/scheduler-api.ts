import type { RunAnswerDto } from '../dto/internal/run-answer-dto.js';
import type { RunAnswerResultDto } from '../dto/internal/run-answer-result-dto.js';

/**
 * What other modules may ask of scheduler. Only shared error kinds are thrown: `answer` throws a
 * `ConflictError` when the run cannot take the answer or its ticket already has a run active.
 */
export interface SchedulerApi {
  answer(runId: string, answer: RunAnswerDto): Promise<RunAnswerResultDto>;
}
