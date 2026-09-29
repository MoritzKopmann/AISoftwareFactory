import { Hono, type Context } from 'hono';
import {
  FindingNotFoundError,
  FindingNotOpenError,
  type Finding,
} from '../../../findings/index.js';
import { findingIdParameterSchema } from '../schemas/findings-schemas.js';
import { ticketNumberParameterSchema } from '../../../../shared/http/ticket-number-parameter-schema.js';

export type FindingsPort = {
  readonly list: (projectId: string, ticketNumber?: number) => Promise<ReadonlyArray<Finding>>;
  readonly createTicket: (projectId: string, findingId: number) => Promise<Finding>;
  readonly dismiss: (projectId: string, findingId: number) => Promise<Finding>;
};

function readProjectId(context: Context): string {
  return `${context.req.param('owner')}/${context.req.param('name')}`;
}

async function answerWithFinding(
  context: Context,
  resolve: (projectId: string, findingId: number) => Promise<Finding>,
): Promise<Response> {
  const parsedId = findingIdParameterSchema.safeParse(context.req.param('id'));
  if (!parsedId.success) {
    return context.json({ message: parsedId.error.issues[0]?.message }, 400);
  }

  try {
    return context.json(await resolve(readProjectId(context), parsedId.data));
  } catch (error) {
    if (error instanceof FindingNotFoundError) {
      return context.json({ message: error.message }, 404);
    }
    if (error instanceof FindingNotOpenError) {
      return context.json({ message: error.message }, 409);
    }
    throw error;
  }
}

export function createFindingsRoutes(findings: FindingsPort): Hono {
  return new Hono()
    .get('/:owner/:name/findings', async (context) => {
      const ticketQuery = context.req.query('ticket');
      const parsedTicket =
        ticketQuery === undefined ? undefined : ticketNumberParameterSchema.safeParse(ticketQuery);
      if (parsedTicket?.success === false) {
        return context.json({ message: parsedTicket.error.issues[0]?.message }, 400);
      }

      return context.json({
        findings: await findings.list(readProjectId(context), parsedTicket?.data),
      });
    })
    .post('/:owner/:name/findings/:id/ticket', (context) =>
      answerWithFinding(context, (projectId, findingId) =>
        findings.createTicket(projectId, findingId),
      ),
    )
    .post('/:owner/:name/findings/:id/dismiss', (context) =>
      answerWithFinding(context, (projectId, findingId) => findings.dismiss(projectId, findingId)),
    );
}
