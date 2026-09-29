import { Hono, type Context } from 'hono';
import {
  RunAlreadyActiveError,
  RunNotActiveError,
  type ActiveRun,
  type Run,
} from '../../../runner/index.js';
import {
  RunNotAvailableError,
  type RunAvailability,
  type StartedRun,
} from '../../../scheduler/index.js';
import type { TicketRunResponse } from '../schemas/runs-schemas.js';
import { ticketNumberParameterSchema } from '../../../../shared/http/ticket-number-parameter-schema.js';

export type RunsPort = {
  readonly availability: (projectId: string, ticketNumber: number) => Promise<RunAvailability>;
  readonly activeRun: (projectId: string) => Promise<ActiveRun | undefined>;
  readonly latestRun: (projectId: string, ticketNumber: number) => Promise<Run | undefined>;
  readonly start: (projectId: string, ticketNumber: number) => Promise<StartedRun>;
  readonly stop: (runId: string) => Promise<void>;
};

function readProjectId(context: Context): string {
  return `${context.req.param('owner')}/${context.req.param('name')}`;
}

export function createRunRoutes(runs: RunsPort): Hono {
  return new Hono()
    .get('/projects/:owner/:name/tickets/:number/run', async (context) => {
      const parsedNumber = ticketNumberParameterSchema.safeParse(context.req.param('number'));
      if (!parsedNumber.success) {
        return context.json({ message: parsedNumber.error.issues[0]?.message }, 400);
      }

      const projectId = readProjectId(context);
      const ticketNumber = parsedNumber.data;
      const [availability, activeRun, latestRun] = await Promise.all([
        runs.availability(projectId, ticketNumber),
        runs.activeRun(projectId),
        runs.latestRun(projectId, ticketNumber),
      ]);

      const response: TicketRunResponse = {
        availability,
        ...(activeRun?.run.ticketNumber === ticketNumber
          ? {
              activeRun: {
                id: activeRun.run.id,
                startedAt: activeRun.run.startedAt,
                steps: [...activeRun.steps],
              },
            }
          : {}),
        ...(latestRun?.ending !== undefined && latestRun.endedAt !== undefined
          ? {
              lastRun: {
                id: latestRun.id,
                startedAt: latestRun.startedAt,
                endedAt: latestRun.endedAt,
                ending: latestRun.ending,
              },
            }
          : {}),
      };
      return context.json(response);
    })
    .post('/projects/:owner/:name/tickets/:number/runs', async (context) => {
      const parsedNumber = ticketNumberParameterSchema.safeParse(context.req.param('number'));
      if (!parsedNumber.success) {
        return context.json({ message: parsedNumber.error.issues[0]?.message }, 400);
      }

      try {
        const startedRun = await runs.start(readProjectId(context), parsedNumber.data);
        return context.json(startedRun, 201);
      } catch (error) {
        if (error instanceof RunNotAvailableError || error instanceof RunAlreadyActiveError) {
          return context.json({ message: error.message }, 409);
        }
        throw error;
      }
    })
    .post('/runs/:runId/stop', async (context) => {
      try {
        await runs.stop(context.req.param('runId'));
        return context.body(null, 204);
      } catch (error) {
        if (error instanceof RunNotActiveError) {
          return context.json({ message: error.message }, 409);
        }
        throw error;
      }
    });
}
