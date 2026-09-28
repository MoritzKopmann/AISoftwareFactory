import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { createTicketsRoutes } from '../../../../../src/modules/ui/api/routes/create-tickets-routes.js';
import {
  projectBoardResponseSchema,
  projectTicketResponseSchema,
} from '../../../../../src/modules/ui/api/schemas/tickets-schemas.js';
import type { RunsPort, WatcherPort } from '../../../../../src/modules/ui/index.js';
import type { ProjectBoard, ProjectTicket } from '../../../../../src/modules/watcher/index.js';
import { buildTicket } from '../../../watcher/fakes/build-ticket.js';

const checkedAt = '2026-09-28T12:00:00.000Z';
const okSync = { state: 'ok', checkedAt, snapshotTakenAt: checkedAt } as const;

class FakeWatcher implements WatcherPort {
  readonly ticketRequests: Array<{ projectId: string; number: number }> = [];
  readonly boards = new Map<string, ProjectBoard>();
  readonly tickets = new Map<string, ProjectTicket>();

  board(projectId: string): ProjectBoard | undefined {
    return this.boards.get(projectId);
  }

  async ticket(projectId: string, number: number): Promise<ProjectTicket | undefined> {
    this.ticketRequests.push({ projectId, number });
    return this.tickets.get(`${projectId}#${number}`);
  }
}

function createTestApp(
  watcher: WatcherPort,
  activeRun: Awaited<ReturnType<RunsPort['activeRun']>> = undefined,
): Hono {
  return new Hono().route(
    '/projects',
    createTicketsRoutes(watcher, { activeRun: async () => activeRun }),
  );
}

describe('createTicketsRoutes', () => {
  describe('GET /:owner/:name/board', () => {
    it('should answer 200 with the board rows when the project is watched', async () => {
      const watcher = new FakeWatcher();
      watcher.boards.set('owner/name', {
        projectId: 'owner/name',
        sync: okSync,
        board: {
          rows: [
            { key: 'idea', tickets: [buildTicket({ number: 1 })], totalCount: 1 },
            { key: 'closed', tickets: [], totalCount: 120 },
          ],
        },
      });

      const response = await createTestApp(watcher).request('/projects/owner/name/board');

      expect(response.status).toBe(200);
      const body = projectBoardResponseSchema.parse(await response.json());
      expect(body.sync.state).toBe('ok');
      expect(body.board?.rows.map((row) => [row.key, row.totalCount])).toEqual([
        ['idea', 1],
        ['closed', 120],
      ]);
    });

    it('should answer 200 with a pending sync and no board when the first snapshot is not done', async () => {
      const watcher = new FakeWatcher();
      watcher.boards.set('owner/name', { projectId: 'owner/name', sync: { state: 'pending' } });

      const response = await createTestApp(watcher).request('/projects/owner/name/board');

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        projectId: 'owner/name',
        sync: { state: 'pending' },
      });
    });

    it('should answer 200 with the failure cause and the last good board when the watcher failed', async () => {
      const watcher = new FakeWatcher();
      watcher.boards.set('owner/name', {
        projectId: 'owner/name',
        sync: {
          state: 'failed',
          cause: 'rate-limited',
          message: 'GitHub rate limit reached until 12:10',
          failedAt: checkedAt,
          retryAt: '2026-09-28T12:10:00.000Z',
          snapshotTakenAt: checkedAt,
        },
        board: { rows: [{ key: 'idea', tickets: [], totalCount: 0 }] },
      });

      const response = await createTestApp(watcher).request('/projects/owner/name/board');

      expect(response.status).toBe(200);
      const body = projectBoardResponseSchema.parse(await response.json());
      expect(body.sync).toMatchObject({
        state: 'failed',
        cause: 'rate-limited',
        message: 'GitHub rate limit reached until 12:10',
      });
      expect(body.board).toBeDefined();
    });

    it('should name the running ticket when the project has an active run', async () => {
      const watcher = new FakeWatcher();
      watcher.boards.set('owner/name', { projectId: 'owner/name', sync: { state: 'pending' } });
      const activeRun = {
        run: {
          id: 'run-1',
          projectId: 'owner/name',
          ticketNumber: 139,
          stage: 'implement',
          mode: 'afk',
          sessionId: 'session-1',
          worktreePath: '/worktrees/name/139',
          branchName: 'aisf/139-run-api',
          state: 'running',
          startedAt: checkedAt,
        },
        steps: [],
      } as const;

      const response = await createTestApp(watcher, activeRun).request(
        '/projects/owner/name/board',
      );

      expect(projectBoardResponseSchema.parse(await response.json()).runningTicketNumber).toBe(139);
    });

    it('should leave runningTicketNumber out when the project has no active run', async () => {
      const watcher = new FakeWatcher();
      watcher.boards.set('owner/name', { projectId: 'owner/name', sync: { state: 'pending' } });

      const response = await createTestApp(watcher).request('/projects/owner/name/board');

      expect(await response.json()).not.toHaveProperty('runningTicketNumber');
    });

    it('should answer 404 with a message when the project is not watched', async () => {
      const response = await createTestApp(new FakeWatcher()).request(
        '/projects/owner/unknown/board',
      );

      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ message: 'owner/unknown is not a watched project' });
    });
  });

  describe('GET /:owner/:name/tickets/:number', () => {
    it('should answer 200 with the ticket and ask the watcher for owner/name and the number', async () => {
      const watcher = new FakeWatcher();
      watcher.tickets.set('owner/name#7', {
        projectId: 'owner/name',
        sync: okSync,
        ticket: buildTicket({ number: 7, status: 'ready', hitl: true }),
      });

      const response = await createTestApp(watcher).request('/projects/owner/name/tickets/7');

      expect(response.status).toBe(200);
      const body = projectTicketResponseSchema.parse(await response.json());
      expect(body.ticket).toMatchObject({ number: 7, status: 'ready', hitl: true });
      expect(watcher.ticketRequests).toEqual([{ projectId: 'owner/name', number: 7 }]);
    });

    it('should answer 200 with the failure and no ticket when the live fetch failed', async () => {
      const watcher = new FakeWatcher();
      watcher.tickets.set('owner/name#7', {
        projectId: 'owner/name',
        sync: {
          state: 'failed',
          cause: 'auth',
          message: 'Run gh auth login',
          failedAt: checkedAt,
        },
      });

      const response = await createTestApp(watcher).request('/projects/owner/name/tickets/7');

      expect(response.status).toBe(200);
      const body = projectTicketResponseSchema.parse(await response.json());
      expect(body.sync).toMatchObject({ state: 'failed', cause: 'auth' });
      expect(body.ticket).toBeUndefined();
    });

    it('should answer 404 with a message when the ticket is not found or the project is not watched', async () => {
      const response = await createTestApp(new FakeWatcher()).request(
        '/projects/owner/name/tickets/99',
      );

      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({
        message: 'owner/name has no ticket #99, or is not a watched project',
      });
    });

    it.each(['abc', '0', '-1', '1.5', '1e3'])(
      'should answer 400 and never ask the watcher when the number is %s',
      async (number) => {
        const watcher = new FakeWatcher();

        const response = await createTestApp(watcher).request(
          `/projects/owner/name/tickets/${number}`,
        );

        expect(response.status).toBe(400);
        expect(await response.json()).toEqual({ message: expect.any(String) });
        expect(watcher.ticketRequests).toHaveLength(0);
      },
    );
  });
});
