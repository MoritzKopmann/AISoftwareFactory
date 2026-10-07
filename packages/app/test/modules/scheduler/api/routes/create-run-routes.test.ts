import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import {
  createRunRoutes,
  type TicketRuns,
} from '../../../../../src/modules/scheduler/api/routes/create-run-routes.js';
import {
  sessionLogResponseSchema,
  startedRunResponseSchema,
  ticketRunResponseSchema,
} from '../../../../../src/modules/scheduler/api/schemas/runs-schemas.js';
import type { SessionLog } from '../../../../../src/modules/scheduler/logic/domain/types/session-log.js';
import type { TicketRun } from '../../../../../src/modules/scheduler/logic/domain/types/ticket-run.js';
import { RunAlreadyActiveError } from '../../../../../src/modules/scheduler/logic/errors/run-already-active-error.js';
import { TicketNotResettableError } from '../../../../../src/modules/scheduler/logic/errors/ticket-not-resettable-error.js';
import { RunNotAvailableError } from '../../../../../src/modules/scheduler/logic/errors/run-not-available-error.js';

const startedAt = '2026-09-29T09:00:00.000Z';
const endedAt = '2026-09-29T09:30:00.000Z';

class FakeTicketRuns implements TicketRuns {
  ticketRun: TicketRun = { availability: { kind: 'available' } };
  startFailure: Error | undefined;
  resetFailure: Error | undefined;
  sessionLog: SessionLog = { kind: 'no-session' };
  readonly calls: string[] = [];

  async readSessionLog(projectId: string, ticketNumber: number): Promise<SessionLog> {
    this.calls.push(`sessionLog ${projectId} #${ticketNumber}`);
    return this.sessionLog;
  }

  async read(projectId: string, ticketNumber: number): Promise<TicketRun> {
    this.calls.push(`read ${projectId} #${ticketNumber}`);
    return this.ticketRun;
  }

  async reset(projectId: string, ticketNumber: number): Promise<void> {
    this.calls.push(`reset ${projectId} #${ticketNumber}`);
    if (this.resetFailure !== undefined) {
      throw this.resetFailure;
    }
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

    it('should answer the active run with its steps when the ticket run has one', async () => {
      const ticketRuns = new FakeTicketRuns();
      ticketRuns.ticketRun = {
        availability: { kind: 'disabled', reason: '#139 is running' },
        activeRun: {
          id: 'run-1',
          startedAt,
          steps: [{ at: '2026-09-29T09:01:00.000Z', summary: 'Read the ticket' }],
        },
      };

      const response = await createTestApp(ticketRuns).request(
        '/projects/owner/name/tickets/139/run',
      );

      expect(ticketRunResponseSchema.parse(await response.json()).activeRun).toEqual({
        id: 'run-1',
        startedAt,
        steps: [{ at: '2026-09-29T09:01:00.000Z', summary: 'Read the ticket' }],
      });
    });

    it('should expose waitingFor without artifactId when the active run waits', async () => {
      const ticketRuns = new FakeTicketRuns();
      ticketRuns.ticketRun = {
        availability: { kind: 'disabled', reason: '#7 is running' },
        activeRun: {
          id: 'run-1',
          startedAt,
          steps: [],
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

    it('should expose a permission wait and its start when the active run waits for a permission', async () => {
      const ticketRuns = new FakeTicketRuns();
      const waitingSince = '2026-10-07T10:00:00.000Z';
      ticketRuns.ticketRun = {
        availability: { kind: 'disabled', reason: '#7 is running' },
        activeRun: {
          id: 'run-1',
          startedAt,
          steps: [],
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

    it('should expose waitingSince for a checkpoint wait', async () => {
      const ticketRuns = new FakeTicketRuns();
      ticketRuns.ticketRun = {
        availability: { kind: 'disabled', reason: '#7 is running' },
        activeRun: {
          id: 'run-1',
          startedAt,
          steps: [],
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
        activeRun: { id: 'run-1', startedAt, steps: [] },
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
        endedAt,
        ending: { kind: 'escalated', escalation: 'spec', reason: 'AC 2 is unclear' },
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

  describe('GET /projects/:owner/:name/tickets/:number/session-log', () => {
    it('should answer the entries in order with the total when the ticket has a session', async () => {
      const ticketRuns = new FakeTicketRuns();
      ticketRuns.sessionLog = {
        kind: 'found',
        entries: [{ summary: 'Read: ticket' }, { summary: 'Bash: npm test' }],
        total: 2,
      };

      const response = await createTestApp(ticketRuns).request(
        '/projects/owner/name/tickets/139/session-log',
      );

      expect(response.status).toBe(200);
      expect(sessionLogResponseSchema.parse(await response.json())).toEqual({
        kind: 'found',
        entries: [{ summary: 'Read: ticket' }, { summary: 'Bash: npm test' }],
        total: 2,
      });
      expect(ticketRuns.calls).toEqual(['sessionLog owner/name #139']);
    });

    it('should answer no session when the ticket has no run', async () => {
      const response = await createTestApp(new FakeTicketRuns()).request(
        '/projects/owner/name/tickets/139/session-log',
      );

      expect(response.status).toBe(200);
      expect(sessionLogResponseSchema.parse(await response.json())).toEqual({
        kind: 'no-session',
      });
    });

    it('should answer transcript not found when the transcript is gone', async () => {
      const ticketRuns = new FakeTicketRuns();
      ticketRuns.sessionLog = { kind: 'transcript-not-found' };

      const response = await createTestApp(ticketRuns).request(
        '/projects/owner/name/tickets/139/session-log',
      );

      expect(response.status).toBe(200);
      expect(sessionLogResponseSchema.parse(await response.json())).toEqual({
        kind: 'transcript-not-found',
      });
    });

    it('should answer 400 when the ticket number is not a positive integer', async () => {
      const response = await createTestApp(new FakeTicketRuns()).request(
        '/projects/owner/name/tickets/abc/session-log',
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

  describe('POST /projects/:owner/:name/tickets/:number/reset', () => {
    it('should answer 204 with an empty body when the reset succeeds', async () => {
      const ticketRuns = new FakeTicketRuns();

      const response = await createTestApp(ticketRuns).request(
        '/projects/moritz/aisf/tickets/138/reset',
        { method: 'POST' },
      );

      expect(response.status).toBe(204);
      expect(await response.text()).toBe('');
      expect(ticketRuns.calls).toEqual(['reset moritz/aisf #138']);
    });

    it('should answer 409 with the message when the ticket is not resettable', async () => {
      const ticketRuns = new FakeTicketRuns();
      ticketRuns.resetFailure = new TicketNotResettableError('#138 is not stuck or in progress');

      const response = await createTestApp(ticketRuns).request(
        '/projects/moritz/aisf/tickets/138/reset',
        { method: 'POST' },
      );

      expect(response.status).toBe(409);
      expect(await response.json()).toEqual({ message: '#138 is not stuck or in progress' });
    });

    it('should answer 400 and not reset when the ticket number is bad', async () => {
      const ticketRuns = new FakeTicketRuns();

      const response = await createTestApp(ticketRuns).request(
        '/projects/moritz/aisf/tickets/abc/reset',
        { method: 'POST' },
      );

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        message: 'The ticket number must be a positive integer',
      });
      expect(ticketRuns.calls).toEqual([]);
    });
  });
});
