import type { ActiveRun } from '../../../business/domain/types/active-run.js';
import type { ActiveWait } from '../../../business/domain/types/active-wait.js';
import type { RunAnswer } from '../../../business/domain/types/run-answer.js';
import type { Run } from '../../../business/domain/types/run.js';
import type { StartRunRequest } from '../../../business/domain/types/start-run-request.js';
import type { ActiveRunDto } from '../internal/active-run-dto.js';
import type { ActiveWaitDto } from '../internal/active-wait-dto.js';
import type { RunAnswerDto } from '../internal/run-answer-dto.js';
import type { RunDto } from '../internal/run-dto.js';
import type { StartRunRequestDto } from '../internal/start-run-request-dto.js';

export function toRunDto(run: Run): RunDto {
  return { ...run };
}

export function toActiveRunDto(activeRun: ActiveRun): ActiveRunDto {
  return { run: toRunDto(activeRun.run) };
}

export function toActiveWaitDto(wait: ActiveWait): ActiveWaitDto {
  return { ticketNumber: wait.ticketNumber, kind: wait.kind, since: wait.since };
}

export function toRunAnswer(answer: RunAnswerDto): RunAnswer {
  return { ...answer };
}

export function toStartRunRequest(request: StartRunRequestDto): StartRunRequest {
  return { ...request };
}
