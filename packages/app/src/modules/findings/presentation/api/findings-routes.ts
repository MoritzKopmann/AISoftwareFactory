import { Hono, type Context } from 'hono';
import { statusForDomainError, ticketNumberParameterSchema } from '../../../../shared/http.js';
import type { Finding } from '../../business/domain/types/finding.js';
import type { FindingService } from '../../business/service/finding-service.js';
import { findingIdParameterSchema } from '../dto/api/findings-schemas.js';
import { toFindingResponse } from '../dto/mapper/finding-mapper.js';

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
    return context.json(toFindingResponse(await resolve(readProjectId(context), parsedId.data)));
  } catch (error) {
    const status = statusForDomainError(error);
    if (status === undefined || !(error instanceof Error)) {
      throw error;
    }
    return context.json({ message: error.message }, status);
  }
}

/** The module's route table, with full paths. */
export function createFindingsRoutes(findingService: FindingService): Hono {
  return new Hono()
    .get('/api/projects/:owner/:name/findings', async (context) => {
      const ticketQuery = context.req.query('ticket');
      const parsedTicket =
        ticketQuery === undefined ? undefined : ticketNumberParameterSchema.safeParse(ticketQuery);
      if (parsedTicket?.success === false) {
        return context.json({ message: parsedTicket.error.issues[0]?.message }, 400);
      }

      const findings = await findingService.list(readProjectId(context), parsedTicket?.data);
      return context.json({ findings: findings.map(toFindingResponse) });
    })
    .post('/api/projects/:owner/:name/findings/:id/ticket', (context) =>
      answerWithFinding(context, (projectId, findingId) =>
        findingService.createTicket(projectId, findingId),
      ),
    )
    .post('/api/projects/:owner/:name/findings/:id/dismiss', (context) =>
      answerWithFinding(context, (projectId, findingId) =>
        findingService.dismiss(projectId, findingId),
      ),
    );
}
