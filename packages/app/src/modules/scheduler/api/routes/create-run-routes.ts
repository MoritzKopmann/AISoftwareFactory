import { Hono, type Context } from 'hono';
import { ticketNumberParameterSchema } from '../../../../shared/http/ticket-number-parameter-schema.js';
import type { SessionLog } from '../../logic/domain/types/session-log.js';
import type { StartedRun } from '../../logic/domain/types/started-run.js';
import type { TicketRun } from '../../logic/domain/types/ticket-run.js';
import { RunAlreadyActiveError } from '../../logic/errors/run-already-active-error.js';
import { RunNotAvailableError } from '../../logic/errors/run-not-available-error.js';
import { TicketNotResettableError } from '../../logic/errors/ticket-not-resettable-error.js';
import { TicketWriteFailedError } from '../../logic/errors/ticket-write-failed-error.js';
import type { SessionLogResponse, TicketRunResponse } from '../schemas/runs-schemas.js';

export type TicketRuns = {
  readonly read: (projectId: string, ticketNumber: number) => Promise<TicketRun>;
  readonly start: (projectId: string, ticketNumber: number) => Promise<StartedRun>;
  readonly reset: (projectId: string, ticketNumber: number) => Promise<void>;
  readonly readSessionLog: (projectId: string, ticketNumber: number) => Promise<SessionLog>;
};

function readProjectId(context: Context): string {
  return `${context.req.param('owner')}/${context.req.param('name')}`;
}

function toTicketRunResponse({ availability, activeRun, lastRun }: TicketRun): TicketRunResponse {
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
                      ? { kind: 'checkpoint', request: activeRun.waitingFor.request }
                      : {
                          kind: 'permission-needed',
                          toolName: activeRun.waitingFor.toolName,
                          toolInput: activeRun.waitingFor.toolInput,
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

function toSessionLogResponse(sessionLog: SessionLog): SessionLogResponse {
  return sessionLog.kind === 'found'
    ? { kind: 'found', entries: [...sessionLog.entries], total: sessionLog.total }
    : sessionLog;
}

export function createRunRoutes(ticketRuns: TicketRuns): Hono {
  return new Hono()
    .get('/:owner/:name/tickets/:number/run', async (context) => {
      const parsedNumber = ticketNumberParameterSchema.safeParse(context.req.param('number'));
      if (!parsedNumber.success) {
        return context.json({ message: parsedNumber.error.issues[0]?.message }, 400);
      }

      const ticketRun = await ticketRuns.read(readProjectId(context), parsedNumber.data);
      return context.json(toTicketRunResponse(ticketRun));
    })
    .get('/:owner/:name/tickets/:number/session-log', async (context) => {
      const parsedNumber = ticketNumberParameterSchema.safeParse(context.req.param('number'));
      if (!parsedNumber.success) {
        return context.json({ message: parsedNumber.error.issues[0]?.message }, 400);
      }

      const sessionLog = await ticketRuns.readSessionLog(readProjectId(context), parsedNumber.data);
      return context.json(toSessionLogResponse(sessionLog));
    })
    .post('/:owner/:name/tickets/:number/runs', async (context) => {
      const parsedNumber = ticketNumberParameterSchema.safeParse(context.req.param('number'));
      if (!parsedNumber.success) {
        return context.json({ message: parsedNumber.error.issues[0]?.message }, 400);
      }

      try {
        const startedRun = await ticketRuns.start(readProjectId(context), parsedNumber.data);
        return context.json(startedRun, 201);
      } catch (error) {
        if (error instanceof RunNotAvailableError || error instanceof RunAlreadyActiveError) {
          return context.json({ message: error.message }, 409);
        }
        throw error;
      }
    })
    .post('/:owner/:name/tickets/:number/reset', async (context) => {
      const parsedNumber = ticketNumberParameterSchema.safeParse(context.req.param('number'));
      if (!parsedNumber.success) {
        return context.json({ message: parsedNumber.error.issues[0]?.message }, 400);
      }

      try {
        await ticketRuns.reset(readProjectId(context), parsedNumber.data);
        return context.body(null, 204);
      } catch (error) {
        if (error instanceof TicketNotResettableError) {
          return context.json({ message: error.message }, 409);
        }
        if (error instanceof TicketWriteFailedError) {
          return context.json({ message: error.message }, 502);
        }
        throw error;
      }
    });
}
