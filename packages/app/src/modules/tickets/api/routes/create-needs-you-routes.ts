import { Hono } from 'hono';
import type { NeedsYouRow } from '../../logic/domain/types/needs-you-row.js';

export type NeedsYouReads = {
  readonly read: (projectId: string) => Promise<ReadonlyArray<NeedsYouRow> | undefined>;
};

export function createNeedsYouRoutes(needsYou: NeedsYouReads): Hono {
  return new Hono().get('/:owner/:name/needs-you', async (context) => {
    const projectId = `${context.req.param('owner')}/${context.req.param('name')}`;
    const rows = await needsYou.read(projectId);
    if (rows === undefined) {
      return context.json({ message: `${projectId} is not a watched project` }, 404);
    }
    return context.json({ rows });
  });
}
