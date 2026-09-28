import { Hono, type Context } from 'hono';
import type { ProjectBoard, ProjectTicket } from '../../../watcher/index.js';
import { ticketNumberParameterSchema } from '../schemas/tickets-schemas.js';
import type { RunsPort } from './create-run-routes.js';

export type WatcherPort = {
  readonly board: (projectId: string) => ProjectBoard | undefined;
  readonly ticket: (projectId: string, number: number) => Promise<ProjectTicket | undefined>;
};

function readProjectId(context: Context): string {
  return `${context.req.param('owner')}/${context.req.param('name')}`;
}

export function createTicketsRoutes(watcher: WatcherPort, runs: Pick<RunsPort, 'activeRun'>): Hono {
  return new Hono()
    .get('/:owner/:name/board', async (context) => {
      const projectId = readProjectId(context);
      const projectBoard = watcher.board(projectId);
      if (projectBoard === undefined) {
        return context.json({ message: `${projectId} is not a watched project` }, 404);
      }
      const activeRun = await runs.activeRun(projectId);
      return context.json({
        ...projectBoard,
        ...(activeRun === undefined ? {} : { runningTicketNumber: activeRun.run.ticketNumber }),
      });
    })
    .get('/:owner/:name/tickets/:number', async (context) => {
      const parsedNumber = ticketNumberParameterSchema.safeParse(context.req.param('number'));
      if (!parsedNumber.success) {
        return context.json({ message: parsedNumber.error.issues[0]?.message }, 400);
      }

      const projectId = readProjectId(context);
      const projectTicket = await watcher.ticket(projectId, parsedNumber.data);
      if (projectTicket === undefined) {
        return context.json(
          {
            message: `${projectId} has no ticket #${parsedNumber.data}, or is not a watched project`,
          },
          404,
        );
      }
      return context.json(projectTicket);
    });
}
