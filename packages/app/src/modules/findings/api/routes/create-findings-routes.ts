import { Hono, type Context } from 'hono';
import { ticketNumberParameterSchema } from '../../../../shared/http/ticket-number-parameter-schema.js';
import type { Finding } from '../../logic/domain/types/finding.js';
import { FindingNotFoundError } from '../../logic/errors/finding-not-found-error.js';
import { FindingNotOpenError } from '../../logic/errors/finding-not-open-error.js';
import type { CreateTicketFromFindingUseCase } from '../../logic/use-cases/create-ticket-from-finding-use-case.js';
import type { DismissFindingUseCase } from '../../logic/use-cases/dismiss-finding-use-case.js';
import type { ListFindingsUseCase } from '../../logic/use-cases/list-findings-use-case.js';
import { findingIdParameterSchema } from '../schemas/findings-schemas.js';

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

export function createFindingsRoutes(
  listFindings: ListFindingsUseCase,
  createTicketFromFinding: CreateTicketFromFindingUseCase,
  dismissFinding: DismissFindingUseCase,
): Hono {
  return new Hono()
    .get('/:owner/:name/findings', async (context) => {
      const ticketQuery = context.req.query('ticket');
      const parsedTicket =
        ticketQuery === undefined ? undefined : ticketNumberParameterSchema.safeParse(ticketQuery);
      if (parsedTicket?.success === false) {
        return context.json({ message: parsedTicket.error.issues[0]?.message }, 400);
      }

      return context.json({
        findings: await listFindings.execute(readProjectId(context), parsedTicket?.data),
      });
    })
    .post('/:owner/:name/findings/:id/ticket', (context) =>
      answerWithFinding(context, (projectId, findingId) =>
        createTicketFromFinding.execute(projectId, findingId),
      ),
    )
    .post('/:owner/:name/findings/:id/dismiss', (context) =>
      answerWithFinding(context, (projectId, findingId) =>
        dismissFinding.execute(projectId, findingId),
      ),
    );
}
