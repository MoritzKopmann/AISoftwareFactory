import { Hono } from 'hono';
import type { PermissionDecision } from '../../logic/domain/types/permission-decision.js';
import type { StartedRun } from '../../logic/domain/types/started-run.js';
import { PermissionNotAnswerableError } from '../../logic/errors/permission-not-answerable-error.js';
import { RunAlreadyActiveError } from '../../logic/errors/run-already-active-error.js';
import { permissionAnswerRequestSchema } from '../schemas/runs-schemas.js';

export type PermissionAnswers = {
  readonly answer: (runId: string, decision: PermissionDecision) => Promise<StartedRun>;
};

export function createPermissionRoutes(permissionAnswers: PermissionAnswers): Hono {
  return new Hono().post('/:runId/permission', async (context) => {
    const body: unknown = await context.req.json().catch(() => undefined);
    const parsedBody = permissionAnswerRequestSchema.safeParse(body);
    if (!parsedBody.success) {
      return context.json({ message: parsedBody.error.issues[0]?.message }, 400);
    }

    try {
      const resumedRun = await permissionAnswers.answer(
        context.req.param('runId'),
        parsedBody.data.decision,
      );
      return context.json(resumedRun, 201);
    } catch (error) {
      if (error instanceof PermissionNotAnswerableError || error instanceof RunAlreadyActiveError) {
        return context.json({ message: error.message }, 409);
      }
      throw error;
    }
  });
}
