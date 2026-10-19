import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import type { TicketRunService } from '../../business/service/ticket-run-service.js';
import { createRunRoutes } from './create-run-routes.js';
import { startedRunResponseSchema, ticketRunResponseSchema } from '../dto/api/runs-schemas.js';
import type { TicketRun } from '../../business/domain/types/ticket-run.js';
import { RunAlreadyActiveError } from '../../business/errors/run-already-active-error.js';
import { RunNotAvailableError } from '../../business/errors/run-not-available-error.js';

const startedAt = '2026-09-29T09:00:00.000Z';
const endedAt = '2026-09-29T09:30:00.000Z';

type TicketRuns = Pick<TicketRunService, 'readTicketRun' | 'start'>;

class FakeTicketRuns implements TicketRuns {
  ticketRun: TicketRun = { availability: { kind: 'available' } };
  startFailure: Error | undefined;
  readonly calls: string[] = [];

  async readTicketRun(projectId: string, ticketNumber: number): Promise<TicketRun> {
    this.calls.push(`read ${projectId} #${ticketNumber}`);
    return this.ticketRun;
  }

  async start(projectId: string, ticketNumber: number) {
    this.calls.push(`start ${projectId} #${ticketNumber}`);
    if (this.startFailure !== undefined) {
      throw this.startFailure;
    }
    return { id: 'run-1', startedAt };
  }
}

function createTestApp(ticketRuns: TicketRuns): Hono {
  return new Hono().route('/projects', createRunRoutes(ticketRuns));
}

describe('createRunRoutes', () => {
  describe('GET /projects/:owner/:name/tickets/:number/run', () => {
    it('should answer the availability alone when the ticket run has no runs', async () => {
      const ticketRuns = new FakeTicketRuns();

      const response = await createTestApp(ticketRuns).request(
        '/projects/owner/name/tickets/139/run',
      );

      expect(response.status).toBe(200);
      expect(ticketRunResponseSchema.parse(await response.json())).toEqual({
        availability: { kind: 'available' },
      });
      expect(ticketRuns.calls).toEqual(['read owner/name #139']);
    });

    it('should answer the reason when the availability is disabled', async () => {
      const ticketRuns = new FakeTicketRuns();
      ticketRuns.ticketRun = {
        availability: { kind: 'disabled', reason: '#42 is running' },
      };

      const response = await createTestApp(ticketRuns).request(
        '/projects/owner/name/tickets/139/run',
      );

      expect(ticketRunResponseSchema.parse(await response.json()).availability).toEqual({
        kind: 'disabled',
        reason: '#42 is running',
      });
    });

    it('should answer answerHeld false on the active run when no answer is held', async () => {
      const ticketRuns = new FakeTicketRuns();
      ticketRuns.ticketRun = {
        availability: { kind: 'disabled', reason: '#139 is running' },
        activeRun: { id: 'run-1', startedAt, answerHeld: false },
      };

      const response = await createTestApp(ticketRuns).request(
        '/projects/owner/name/tickets/139/run',
      );

      const body = (await response.json()) as { activeRun: unknown };
      expect(body.activeRun).toEqual({ id: 'run-1', startedAt, answerHeld: false });
    });

    it('should expose waitingFor without artifactId when the active run waits', async () => {
      const ticketRuns = new FakeTicketRuns();
      ticketRuns.ticketRun = {
        availability: { kind: 'disabled', reason: '#7 is running' },
        activeRun: {
          id: 'run-1',
          startedAt,
          answerHeld: false,
          waitingFor: {
            kind: 'checkpoint',
            request: 'Answer on the page Plan',
            artifactId: 'plan',
          },
        },
      };

      const response = await createTestApp(ticketRuns).request(
        '/projects/owner/name/tickets/7/run',
      );

      const body = ticketRunResponseSchema.parse(await response.json());
      expect(body.activeRun?.waitingFor).toEqual({
        kind: 'checkpoint',
        request: 'Answer on the page Plan',
      });
      expect(body.activeRun?.waitingFor).not.toHaveProperty('artifactId');
    });

    it('should expose the page when the checkpoint wait has one', async () => {
      const ticketRuns = new FakeTicketRuns();
      ticketRuns.ticketRun = {
        availability: { kind: 'disabled', reason: '#12 is running' },
        activeRun: {
          id: 'run-1',
          startedAt,
          answerHeld: false,
          waitingFor: {
            kind: 'checkpoint',
            request: 'Answer on the page Plan 12',
            artifactId: 'plan-12',
            page: { title: 'Plan 12', url: '/a/T/' },
          },
        },
      };

      const response = await createTestApp(ticketRuns).request(
        '/projects/owner/name/tickets/12/run',
      );

      const body = ticketRunResponseSchema.parse(await response.json());
      expect(body.activeRun?.waitingFor).toEqual({
        kind: 'checkpoint',
        request: 'Answer on the page Plan 12',
        page: { title: 'Plan 12', url: '/a/T/' },
      });
    });

    it('should expose a permission wait and its start when the active run waits for a permission', async () => {
      const ticketRuns = new FakeTicketRuns();
      const waitingSince = '2026-10-07T10:00:00.000Z';
      ticketRuns.ticketRun = {
        availability: { kind: 'disabled', reason: '#7 is running' },
        activeRun: {
          id: 'run-1',
          startedAt,
          answerHeld: false,
          waitingFor: { kind: 'permission-needed', toolName: 'Bash', toolInput: { command: 'ls' } },
          waitingSince,
        },
      };

      const response = await createTestApp(ticketRuns).request(
        '/projects/owner/name/tickets/7/run',
      );

      const body = ticketRunResponseSchema.parse(await response.json());
      expect(body.activeRun?.waitingFor).toEqual({
        kind: 'permission-needed',
        toolName: 'Bash',
        toolInput: { command: 'ls' },
      });
      expect(body.activeRun?.waitingSince).toBe(waitingSince);
    });

    it('should expose the reason of a permission wait and omit it when there is none', async () => {
      const ticketRuns = new FakeTicketRuns();
      const run = {
        id: 'run-1',
        startedAt,
        answerHeld: false,
        waitingSince: '2026-10-07T10:00:00.000Z',
      };
      ticketRuns.ticketRun = {
        availability: { kind: 'disabled', reason: '#7 is running' },
        activeRun: {
          ...run,
          waitingFor: {
            kind: 'permission-needed',
            toolName: 'Bash',
            toolInput: { command: 'ls' },
            reason: 'Needs network',
          },
        },
      };
      const app = createTestApp(ticketRuns);

      const withReason = ticketRunResponseSchema.parse(
        await (await app.request('/projects/owner/name/tickets/7/run')).json(),
      );
      ticketRuns.ticketRun = {
        availability: { kind: 'disabled', reason: '#7 is running' },
        activeRun: {
          ...run,
          waitingFor: { kind: 'permission-needed', toolName: 'Bash', toolInput: { command: 'ls' } },
        },
      };
      const without = ticketRunResponseSchema.parse(
        await (await app.request('/projects/owner/name/tickets/7/run')).json(),
      );

      expect(withReason.activeRun?.waitingFor).toEqual({
        kind: 'permission-needed',
        toolName: 'Bash',
        toolInput: { command: 'ls' },
        reason: 'Needs network',
      });
      expect(without.activeRun?.waitingFor).not.toHaveProperty('reason');
    });

    it('should return the reason of a permission ending when the last run has one', async () => {
      const ticketRuns = new FakeTicketRuns();
      ticketRuns.ticketRun = {
        availability: { kind: 'available' },
        lastRun: {
          id: 'run-1',
          startedAt,
          answerHeld: false,
          endedAt,
          ending: {
            kind: 'permission-needed',
            toolName: 'Bash',
            toolInput: { command: 'ls' },
            reason: 'Needs network',
          },
        },
      };

      const response = await createTestApp(ticketRuns).request(
        '/projects/owner/name/tickets/139/run',
      );

      expect(ticketRunResponseSchema.parse(await response.json()).lastRun?.ending).toMatchObject({
        reason: 'Needs network',
      });
    });

    it('should expose waitingSince for a checkpoint wait', async () => {
      const ticketRuns = new FakeTicketRuns();
      ticketRuns.ticketRun = {
        availability: { kind: 'disabled', reason: '#7 is running' },
        activeRun: {
          id: 'run-1',
          startedAt,
          answerHeld: false,
          waitingFor: { kind: 'checkpoint', request: 'Pick one', artifactId: 'page-1' },
          waitingSince: '2026-10-07T10:00:00.000Z',
        },
      };

      const response = await createTestApp(ticketRuns).request(
        '/projects/owner/name/tickets/7/run',
      );

      const body = ticketRunResponseSchema.parse(await response.json());
      expect(body.activeRun?.waitingFor).toEqual({ kind: 'checkpoint', request: 'Pick one' });
      expect(body.activeRun?.waitingSince).toBe('2026-10-07T10:00:00.000Z');
    });

    it('should expose no waitingFor key when the active run is working', async () => {
      const ticketRuns = new FakeTicketRuns();
      ticketRuns.ticketRun = {
        availability: { kind: 'disabled', reason: '#7 is running' },
        activeRun: { id: 'run-1', startedAt, answerHeld: false },
      };

      const response = await createTestApp(ticketRuns).request(
        '/projects/owner/name/tickets/7/run',
      );

      const body = ticketRunResponseSchema.parse(await response.json());
      expect(body.activeRun).not.toHaveProperty('waitingFor');
      expect(body.activeRun).not.toHaveProperty('waitingSince');
    });

    it('should answer the last run with its ending when the ticket run has one', async () => {
      const ticketRuns = new FakeTicketRuns();
      ticketRuns.ticketRun = {
        availability: { kind: 'available' },
        lastRun: {
          id: 'run-1',
          startedAt,
          answerHeld: false,
          endedAt,
          ending: { kind: 'escalated', escalation: 'spec', reason: 'AC 2 is unclear' },
        },
      };

      const response = await createTestApp(ticketRuns).request(
        '/projects/owner/name/tickets/139/run',
      );

      expect(ticketRunResponseSchema.parse(await response.json()).lastRun).toEqual({
        id: 'run-1',
        startedAt,
        answerHeld: false,
        endedAt,
        ending: { kind: 'escalated', escalation: 'spec', reason: 'AC 2 is unclear' },
      });
    });

    it('should answer answerHeld true on the last run when an answer is held', async () => {
      const ticketRuns = new FakeTicketRuns();
      ticketRuns.ticketRun = {
        availability: { kind: 'available' },
        lastRun: {
          id: 'run-1',
          startedAt,
          answerHeld: true,
          endedAt,
          ending: { kind: 'finished' },
        },
      };

      const response = await createTestApp(ticketRuns).request(
        '/projects/owner/name/tickets/139/run',
      );

      const body = (await response.json()) as { lastRun?: { answerHeld: unknown } };
      expect(body.lastRun?.answerHeld).toBe(true);
    });

    it('should expose the page and not the artifact id when the last run ended at a checkpoint', async () => {
      const ticketRuns = new FakeTicketRuns();
      ticketRuns.ticketRun = {
        availability: { kind: 'available' },
        lastRun: {
          id: 'run-1',
          startedAt,
          answerHeld: false,
          endedAt,
          ending: {
            kind: 'checkpoint',
            request: 'Pick one',
            artifactId: 'plan-1',
            page: { title: 'Plan 1', url: '/pages/t1/' },
          },
        },
      };

      const response = await createTestApp(ticketRuns).request(
        '/projects/owner/name/tickets/139/run',
      );

      const body = (await response.json()) as { lastRun?: { ending: unknown } };

      expect(body.lastRun?.ending).toEqual({
        kind: 'checkpoint',
        request: 'Pick one',
        page: { title: 'Plan 1', url: '/pages/t1/' },
      });
    });

    it('should answer the pending tool call when the last run ended needing permission', async () => {
      const ticketRuns = new FakeTicketRuns();
      const toolInput = { command: 'git push' };
      ticketRuns.ticketRun = {
        availability: { kind: 'available' },
        lastRun: {
          id: 'run-1',
          startedAt,
          answerHeld: false,
          endedAt,
          ending: { kind: 'permission-needed', toolName: 'Bash', toolInput },
        },
      };

      const response = await createTestApp(ticketRuns).request(
        '/projects/owner/name/tickets/139/run',
      );

      expect(ticketRunResponseSchema.parse(await response.json()).lastRun?.ending).toEqual({
        kind: 'permission-needed',
        toolName: 'Bash',
        toolInput,
      });
    });

    it('should answer 400 when the ticket number is not a positive integer', async () => {
      const response = await createTestApp(new FakeTicketRuns()).request(
        '/projects/owner/name/tickets/abc/run',
      );

      expect(response.status).toBe(400);
    });
  });

  describe('POST /projects/:owner/:name/tickets/:number/runs', () => {
    it('should answer 201 with the started run when the run starts', async () => {
      const ticketRuns = new FakeTicketRuns();

      const response = await createTestApp(ticketRuns).request(
        '/projects/owner/name/tickets/139/runs',
        { method: 'POST' },
      );

      expect(response.status).toBe(201);
      expect(startedRunResponseSchema.parse(await response.json())).toEqual({
        id: 'run-1',
        startedAt,
      });
      expect(ticketRuns.calls).toEqual(['start owner/name #139']);
    });

    it('should answer 409 with the reason when the ticket is not available', async () => {
      const ticketRuns = new FakeTicketRuns();
      ticketRuns.startFailure = new RunNotAvailableError('#42 is running');

      const response = await createTestApp(ticketRuns).request(
        '/projects/owner/name/tickets/139/runs',
        { method: 'POST' },
      );

      expect(response.status).toBe(409);
      expect(await response.json()).toEqual({ message: '#42 is running' });
    });

    it('should answer 409 with the reason when another run is already active', async () => {
      const ticketRuns = new FakeTicketRuns();
      ticketRuns.startFailure = new RunAlreadyActiveError('A run is already active');

      const response = await createTestApp(ticketRuns).request(
        '/projects/owner/name/tickets/139/runs',
        { method: 'POST' },
      );

      expect(response.status).toBe(409);
      expect(await response.json()).toEqual({ message: 'A run is already active' });
    });

    it('should answer 400 when the ticket number is not a positive integer', async () => {
      const response = await createTestApp(new FakeTicketRuns()).request(
        '/projects/owner/name/tickets/0/runs',
        { method: 'POST' },
      );

      expect(response.status).toBe(400);
    });
  });
});
