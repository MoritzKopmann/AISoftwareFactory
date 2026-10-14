import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { createNeedsYouRoutes } from './create-needs-you-routes.js';
import { needsYouResponseSchema } from '../dto/api/needs-you-schemas.js';
import type { NeedsYouRow } from '../../business/domain/types/needs-you-row.js';

function createTestApp(rowsByProjectId: ReadonlyMap<string, ReadonlyArray<NeedsYouRow>>): Hono {
  return new Hono().route(
    '/projects',
    createNeedsYouRoutes({ readNeedsYou: async (projectId) => rowsByProjectId.get(projectId) }),
  );
}

describe('createNeedsYouRoutes', () => {
  describe('GET /:owner/:name/needs-you', () => {
    it('should answer 200 with the rows when the project has waiting tickets', async () => {
      const row: NeedsYouRow = {
        ticketNumber: 5,
        title: 'Five',
        action: 'answer-round',
        since: '2026-10-01T10:00:00Z',
      };

      const response = await createTestApp(new Map([['owner/name', [row]]])).request(
        '/projects/owner/name/needs-you',
      );

      expect(response.status).toBe(200);
      expect(needsYouResponseSchema.parse(await response.json())).toEqual({ rows: [row] });
    });

    it('should answer 200 with no rows when nothing is waiting', async () => {
      const response = await createTestApp(new Map([['owner/name', []]])).request(
        '/projects/owner/name/needs-you',
      );

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ rows: [] });
    });

    it('should answer 404 when the project is unknown', async () => {
      const response = await createTestApp(new Map()).request('/projects/owner/none/needs-you');

      expect(response.status).toBe(404);
    });
  });
});
