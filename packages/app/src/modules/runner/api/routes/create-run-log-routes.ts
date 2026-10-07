import { Hono } from 'hono';
import { ticketNumberParameterSchema } from '../../../../shared/http/ticket-number-parameter-schema.js';
import type { RunLog } from '../../logic/domain/types/run-log.js';
import type { ReadTicketRunLogUseCase } from '../../logic/use-cases/read-ticket-run-log-use-case.js';
import type { RunLogResponse } from '../schemas/run-log-schemas.js';

function toRunLogResponse(runLog: RunLog): RunLogResponse {
  return runLog.kind === 'found'
    ? { kind: 'found', entries: [...runLog.entries], total: runLog.total }
    : runLog;
}

export function createRunLogRoutes(readTicketRunLog: ReadTicketRunLogUseCase): Hono {
  return new Hono().get('/:owner/:name/tickets/:number/run-log', async (context) => {
    const parsedNumber = ticketNumberParameterSchema.safeParse(context.req.param('number'));
    if (!parsedNumber.success) {
      return context.json({ message: parsedNumber.error.issues[0]?.message }, 400);
    }

    const projectId = `${context.req.param('owner')}/${context.req.param('name')}`;
    return context.json(
      toRunLogResponse(await readTicketRunLog.execute(projectId, parsedNumber.data)),
    );
  });
}
