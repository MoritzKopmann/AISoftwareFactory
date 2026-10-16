import type { RunEnding } from '../../../business/domain/types/run-ending.js';
import type { RunAnswer } from '../../../business/domain/types/run-answer.js';
import type { StartedRun } from '../../../business/domain/types/started-run.js';
import type { TicketRun } from '../../../business/domain/types/ticket-run.js';
import type {
  CheckpointAnswerRequest,
  PermissionAnswerRequest,
  RunEndingResponse,
  StartedRunResponse,
  TicketRunResponse,
} from '../api/runs-schemas.js';
import type { RunAnswerDto } from '../internal/run-answer-dto.js';
import type { StartedRunDto } from '../internal/started-run-dto.js';

function toRunEndingResponse(ending: RunEnding): RunEndingResponse {
  switch (ending.kind) {
    case 'escalated':
      return { kind: 'escalated', escalation: ending.escalation, reason: ending.reason };
    case 'permission-needed':
      return {
        kind: 'permission-needed',
        toolName: ending.toolName,
        toolInput: ending.toolInput,
        ...(ending.reason === undefined ? {} : { reason: ending.reason }),
      };
    case 'parked':
      return { kind: 'parked', blockerNumber: ending.blockerNumber };
    case 'crashed':
      return { kind: 'crashed', reason: ending.reason };
    case 'usage-limit':
      return { kind: 'usage-limit', reason: ending.reason };
    case 'finished':
    case 'stopped':
    case 'app-restarted':
      return { kind: ending.kind };
    case 'checkpoint':
      return {
        kind: 'checkpoint',
        request: ending.request,
        ...(ending.page === undefined
          ? {}
          : { page: { title: ending.page.title, url: ending.page.url } }),
      };
  }
}

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
    ...(lastRun === undefined
      ? {}
      : {
          lastRun: {
            id: lastRun.id,
            startedAt: lastRun.startedAt,
            endedAt: lastRun.endedAt,
            ending: toRunEndingResponse(lastRun.ending),
          },
        }),
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
