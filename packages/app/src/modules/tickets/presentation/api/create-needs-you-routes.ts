import { Hono } from 'hono';
import type { TicketReadService } from '../../business/service/ticket-read-service.js';
import { toNeedsYouRowResponse } from '../dto/mapper/needs-you-mapper.js';

export function createNeedsYouRoutes(
  ticketReadService: Pick<TicketReadService, 'readNeedsYou'>,
): Hono {
  return new Hono().get('/:owner/:name/needs-you', async (context) => {
    const projectId = `${context.req.param('owner')}/${context.req.param('name')}`;
    const rows = await ticketReadService.readNeedsYou(projectId);
    if (rows === undefined) {
      return context.json({ message: `${projectId} is not a watched project` }, 404);
    }
    return context.json({ rows: rows.map(toNeedsYouRowResponse) });
  });
}
