import { Hono, type Context } from 'hono';
import { statusForDomainError } from '../../../../shared/http.js';
import type { RunAnswer } from '../../business/domain/types/run-answer.js';
import type { TicketRunService } from '../../business/service/ticket-run-service.js';
import {
  checkpointAnswerRequestSchema,
  permissionAnswerRequestSchema,
  sendMessageBodySchema,
} from '../dto/api/runs-schemas.js';
import {
  toCheckpointRunAnswer,
  toPermissionRunAnswer,
  toStartedRunResponse,
} from '../dto/mapper/run-mapper.js';
import { readJsonBody } from './read-json-body.js';

export function createRunAnswerRoutes(
  ticketRunService: Pick<TicketRunService, 'answer' | 'sendMessage'>,
): Hono {
  async function resume(context: Context, answer: RunAnswer) {
    try {
      const outcome = await ticketRunService.answer(context.req.param('runId') ?? '', answer);
      if (outcome.kind === 'held') {
        return context.json({ held: true as const, pausedUntil: outcome.pausedUntil }, 202);
      }
      return context.json(toStartedRunResponse(outcome.run), 201);
    } catch (error) {
      return refusal(context, error);
    }
  }

  function refusal(context: Context, error: unknown) {
    const status = statusForDomainError(error);
    if (status === undefined || !(error instanceof Error)) {
      throw error;
    }
    return context.json({ message: error.message }, status);
  }

  async function send(context: Context, text: string) {
    try {
      const outcome = await ticketRunService.sendMessage(context.req.param('runId') ?? '', text);
      if (outcome.kind === 'pushed') {
        return context.body(null, 204);
      }
      if (outcome.kind === 'held') {
        return context.json({ held: true as const, pausedUntil: outcome.pausedUntil }, 202);
      }
      return context.json(toStartedRunResponse(outcome.run), 201);
    } catch (error) {
      return refusal(context, error);
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
    })
    .post('/:runId/messages', async (context) => {
      const parsedBody = sendMessageBodySchema.safeParse(await readJsonBody(context));
      if (!parsedBody.success) {
        return context.json({ message: parsedBody.error.issues[0]?.message }, 400);
      }
      return send(context, parsedBody.data.text);
    });
}
