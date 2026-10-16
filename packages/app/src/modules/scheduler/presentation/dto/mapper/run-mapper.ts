import type { RunAnswer } from '../../../business/domain/types/run-answer.js';
import type { StartedRun } from '../../../business/domain/types/started-run.js';
import type { TicketRun } from '../../../business/domain/types/ticket-run.js';
import type {
  CheckpointAnswerRequest,
  PermissionAnswerRequest,
  StartedRunResponse,
  TicketRunResponse,
} from '../api/runs-schemas.js';
import type { RunAnswerDto } from '../internal/run-answer-dto.js';
import type { StartedRunDto } from '../internal/started-run-dto.js';

export function toTicketRunResponse({
  availability,
  activeRun,
  lastRun,
}: TicketRun): TicketRunResponse {
  return {
    availability,
    ...(activeRun === undefined
      ? {}
      : {
          activeRun: {
            id: activeRun.id,
            startedAt: activeRun.startedAt,
            steps: [...activeRun.steps],
            ...(activeRun.waitingFor === undefined
              ? {}
              : {
                  waitingFor:
                    activeRun.waitingFor.kind === 'checkpoint'
                      ? {
                          kind: 'checkpoint',
                          request: activeRun.waitingFor.request,
                          ...('page' in activeRun.waitingFor
                            ? { page: activeRun.waitingFor.page }
                            : {}),
                        }
                      : {
                          kind: 'permission-needed',
                          toolName: activeRun.waitingFor.toolName,
                          toolInput: activeRun.waitingFor.toolInput,
                          ...(activeRun.waitingFor.reason === undefined
                            ? {}
                            : { reason: activeRun.waitingFor.reason }),
                        },
                }),
            ...(activeRun.waitingSince === undefined
              ? {}
              : { waitingSince: activeRun.waitingSince }),
          },
        }),
    ...(lastRun === undefined ? {} : { lastRun }),
  };
}

export function toStartedRunResponse(run: StartedRun): StartedRunResponse {
  return { id: run.id, startedAt: run.startedAt };
}

export function toPermissionRunAnswer(request: PermissionAnswerRequest): RunAnswer {
  return { kind: 'permission', decision: request.decision };
}

export function toCheckpointRunAnswer(request: CheckpointAnswerRequest): RunAnswer {
  return { kind: 'checkpoint', text: request.answer };
}

export function toRunAnswer(dto: RunAnswerDto): RunAnswer {
  return dto.kind === 'permission'
    ? { kind: 'permission', decision: dto.decision }
    : { kind: 'checkpoint', text: dto.text };
}

export function toStartedRunDto(run: StartedRun): StartedRunDto {
  return { id: run.id, startedAt: run.startedAt };
}
