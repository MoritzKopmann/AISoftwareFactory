import { Hono, type Context } from 'hono';
import type { RunAnswer } from '../../logic/domain/types/run-answer.js';
import type { StartedRun } from '../../logic/domain/types/started-run.js';
import { RunAlreadyActiveError } from '../../logic/errors/run-already-active-error.js';
import { RunNotAnswerableError } from '../../logic/errors/run-not-answerable-error.js';
import { TicketWriteFailedError } from '../../logic/errors/ticket-write-failed-error.js';
import {
  checkpointAnswerRequestSchema,
  permissionAnswerRequestSchema,
} from '../schemas/runs-schemas.js';

export type RunAnswers = {
  readonly answer: (runId: string, answer: RunAnswer) => Promise<StartedRun>;
};

export function createRunAnswerRoutes(runAnswers: RunAnswers): Hono {
  async function resume(context: Context, answer: RunAnswer) {
    try {
      return context.json(await runAnswers.answer(context.req.param('runId') ?? '', answer), 201);
    } catch (error) {
      if (error instanceof RunNotAnswerableError || error instanceof RunAlreadyActiveError) {
        return context.json({ message: error.message }, 409);
      }
      if (error instanceof TicketWriteFailedError) {
        return context.json({ message: error.message }, 502);
      }
      throw error;
    }
  }

  return new Hono()
    .post('/:runId/permission', async (context) => {
      const body: unknown = await context.req.json().catch(() => undefined);
      const parsedBody = permissionAnswerRequestSchema.safeParse(body);
      if (!parsedBody.success) {
        return context.json({ message: parsedBody.error.issues[0]?.message }, 400);
      }
      return resume(context, { kind: 'permission', decision: parsedBody.data.decision });
    })
    .post('/:runId/checkpoint', async (context) => {
      const body: unknown = await context.req.json().catch(() => undefined);
      const parsedBody = checkpointAnswerRequestSchema.safeParse(body);
      if (!parsedBody.success) {
        return context.json({ message: parsedBody.error.issues[0]?.message }, 400);
      }
      return resume(context, { kind: 'checkpoint', text: parsedBody.data.answer });
    });
}
