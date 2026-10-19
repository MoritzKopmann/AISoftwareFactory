import { Hono, type Context } from 'hono';
import { statusForDomainError } from '../../../../shared/http.js';
import type { RunAnswer } from '../../business/domain/types/run-answer.js';
import type { TicketRunService } from '../../business/service/ticket-run-service.js';
import {
  checkpointAnswerRequestSchema,
  permissionAnswerRequestSchema,
} from '../dto/api/runs-schemas.js';
import {
  toCheckpointRunAnswer,
  toPermissionRunAnswer,
  toStartedRunResponse,
} from '../dto/mapper/run-mapper.js';
import { readJsonBody } from './read-json-body.js';

export function createRunAnswerRoutes(ticketRunService: Pick<TicketRunService, 'answer'>): Hono {
  async function resume(context: Context, answer: RunAnswer) {
    try {
      const outcome = await ticketRunService.answer(context.req.param('runId') ?? '', answer);
      if (outcome.kind === 'held') {
        return context.json({ held: true as const, pausedUntil: outcome.pausedUntil }, 202);
      }
      return context.json(toStartedRunResponse(outcome.run), 201);
    } catch (error) {
      const status = statusForDomainError(error);
      if (status === undefined || !(error instanceof Error)) {
        throw error;
      }
      return context.json({ message: error.message }, status);
    }
  }

  return new Hono()
    .post('/:runId/permission', async (context) => {
      const parsedBody = permissionAnswerRequestSchema.safeParse(await readJsonBody(context));
      if (!parsedBody.success) {
        return context.json({ message: parsedBody.error.issues[0]?.message }, 400);
      }
      return resume(context, toPermissionRunAnswer(parsedBody.data));
    })
    .post('/:runId/checkpoint', async (context) => {
      const parsedBody = checkpointAnswerRequestSchema.safeParse(await readJsonBody(context));
      if (!parsedBody.success) {
        return context.json({ message: parsedBody.error.issues[0]?.message }, 400);
      }
      return resume(context, toCheckpointRunAnswer(parsedBody.data));
    });
}
