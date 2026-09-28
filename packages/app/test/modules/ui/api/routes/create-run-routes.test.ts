import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { createRunRoutes } from '../../../../../src/modules/ui/api/routes/create-run-routes.js';
import {
  startedRunResponseSchema,
  ticketRunResponseSchema,
} from '../../../../../src/modules/ui/api/schemas/runs-schemas.js';
import type { RunsPort } from '../../../../../src/modules/ui/index.js';
import {
  RunAlreadyActiveError,
  RunNotActiveError,
  type ActiveRun,
  type Run,
} from '../../../../../src/modules/runner/index.js';
import {
  RunNotAvailableError,
  type RunAvailability,
} from '../../../../../src/modules/scheduler/index.js';

const startedAt = '2026-09-29T09:00:00.000Z';
const endedAt = '2026-09-29T09:30:00.000Z';

function buildRun(overrides: Partial<Run> = {}): Run {
  return {
    id: 'run-1',
    projectId: 'owner/name',
    ticketNumber: 139,
    stage: 'implement',
    mode: 'afk',
    sessionId: 'session-1',
    worktreePath: '/worktrees/name/139',
    branchName: 'aisf/139-run-api',
    state: 'running',
    startedAt,
    ...overrides,
  };
}

class FakeRunsPort implements RunsPort {
  availabilityAnswer: RunAvailability = { kind: 'available' };
  active: ActiveRun | undefined;
  latest: Run | undefined;
  startFailure: Error | undefined;
  stopFailure: Error | undefined;
  readonly calls: string[] = [];

  async availability(projectId: string, ticketNumber: number): Promise<RunAvailability> {
    this.calls.push(`availability ${projectId} #${ticketNumber}`);
    return this.availabilityAnswer;
  }

  async activeRun(): Promise<ActiveRun | undefined> {
    return this.active;
  }

  async latestRun(): Promise<Run | undefined> {
    return this.latest;
  }

  async start(projectId: string, ticketNumber: number) {
    this.calls.push(`start ${projectId} #${ticketNumber}`);
    if (this.startFailure !== undefined) {
      throw this.startFailure;
    }
    return { id: 'run-1', startedAt };
  }

  async stop(runId: string): Promise<void> {
    this.calls.push(`stop ${runId}`);
    if (this.stopFailure !== undefined) {
      throw this.stopFailure;
    }
  }
}

function createTestApp(runs: RunsPort): Hono {
  return new Hono().route('/', createRunRoutes(runs));
}

describe('createRunRoutes', () => {
  describe('GET /projects/:owner/:name/tickets/:number/run', () => {
    it('should answer available with no runs when the ticket is eligible and never ran', async () => {
      const runs = new FakeRunsPort();

      const response = await createTestApp(runs).request('/projects/owner/name/tickets/139/run');

      expect(response.status).toBe(200);
      expect(ticketRunResponseSchema.parse(await response.json())).toEqual({
        availability: { kind: 'available' },
      });
      expect(runs.calls).toEqual(['availability owner/name #139']);
    });

    it('should answer disabled with the reason when another run blocks this one', async () => {
      const runs = new FakeRunsPort();
      runs.availabilityAnswer = { kind: 'disabled', reason: '#42 is running' };

      const response = await createTestApp(runs).request('/projects/owner/name/tickets/139/run');

      expect(ticketRunResponseSchema.parse(await response.json()).availability).toEqual({
        kind: 'disabled',
        reason: '#42 is running',
      });
    });

    it('should answer absent when the ticket cannot be run', async () => {
      const runs = new FakeRunsPort();
      runs.availabilityAnswer = { kind: 'absent' };

      const response = await createTestApp(runs).request('/projects/owner/name/tickets/139/run');

      expect(ticketRunResponseSchema.parse(await response.json()).availability).toEqual({
        kind: 'absent',
      });
    });

    it('should return the active run with its steps when the ticket is running', async () => {
      const runs = new FakeRunsPort();
      runs.active = {
        run: buildRun(),
        steps: [
          { at: '2026-09-29T09:01:00.000Z', summary: 'Read the ticket' },
          { at: '2026-09-29T09:02:00.000Z', summary: 'Wrote a failing test' },
        ],
      };

      const response = await createTestApp(runs).request('/projects/owner/name/tickets/139/run');

      expect(ticketRunResponseSchema.parse(await response.json()).activeRun).toEqual({
        id: 'run-1',
        startedAt,
        steps: [
          { at: '2026-09-29T09:01:00.000Z', summary: 'Read the ticket' },
          { at: '2026-09-29T09:02:00.000Z', summary: 'Wrote a failing test' },
        ],
      });
    });

    it('should leave out the active run when the project runs another ticket', async () => {
      const runs = new FakeRunsPort();
      runs.active = { run: buildRun({ ticketNumber: 42 }), steps: [] };

      const response = await createTestApp(runs).request('/projects/owner/name/tickets/139/run');

      expect(ticketRunResponseSchema.parse(await response.json()).activeRun).toBeUndefined();
    });

    it('should return the last run with its ending when the latest run ended', async () => {
      const runs = new FakeRunsPort();
      runs.latest = buildRun({
        state: 'settled',
        endedAt,
        ending: { kind: 'escalated', escalation: 'spec', reason: 'AC 2 is unclear' },
      });

      const response = await createTestApp(runs).request('/projects/owner/name/tickets/139/run');

      expect(ticketRunResponseSchema.parse(await response.json()).lastRun).toEqual({
        id: 'run-1',
        startedAt,
        endedAt,
        ending: { kind: 'escalated', escalation: 'spec', reason: 'AC 2 is unclear' },
      });
    });

    it('should leave out the last run when the latest run is still running', async () => {
      const runs = new FakeRunsPort();
      runs.latest = buildRun();

      const response = await createTestApp(runs).request('/projects/owner/name/tickets/139/run');

      expect(ticketRunResponseSchema.parse(await response.json()).lastRun).toBeUndefined();
    });

    it('should answer 400 when the ticket number is not a positive integer', async () => {
      const response = await createTestApp(new FakeRunsPort()).request(
        '/projects/owner/name/tickets/abc/run',
      );

      expect(response.status).toBe(400);
    });
  });

  describe('POST /projects/:owner/:name/tickets/:number/runs', () => {
    it('should answer 201 with the started run when the ticket is eligible', async () => {
      const runs = new FakeRunsPort();

      const response = await createTestApp(runs).request('/projects/owner/name/tickets/139/runs', {
        method: 'POST',
      });

      expect(response.status).toBe(201);
      expect(startedRunResponseSchema.parse(await response.json())).toEqual({
        id: 'run-1',
        startedAt,
      });
      expect(runs.calls).toEqual(['start owner/name #139']);
    });

    it('should answer 409 with the reason when the scheduler refuses the run', async () => {
      const runs = new FakeRunsPort();
      runs.startFailure = new RunNotAvailableError('#42 is running');

      const response = await createTestApp(runs).request('/projects/owner/name/tickets/139/runs', {
        method: 'POST',
      });

      expect(response.status).toBe(409);
      expect(await response.json()).toEqual({ message: '#42 is running' });
    });

    it('should answer 409 when the runner already has an active run', async () => {
      const runs = new FakeRunsPort();
      runs.startFailure = new RunAlreadyActiveError('A run is already active');

      const response = await createTestApp(runs).request('/projects/owner/name/tickets/139/runs', {
        method: 'POST',
      });

      expect(response.status).toBe(409);
      expect(await response.json()).toEqual({ message: 'A run is already active' });
    });

    it('should answer 400 when the ticket number is not a positive integer', async () => {
      const response = await createTestApp(new FakeRunsPort()).request(
        '/projects/owner/name/tickets/0/runs',
        { method: 'POST' },
      );

      expect(response.status).toBe(400);
    });
  });

  describe('POST /runs/:runId/stop', () => {
    it('should stop the run and answer 204 when the run is active', async () => {
      const runs = new FakeRunsPort();

      const response = await createTestApp(runs).request('/runs/run-1/stop', { method: 'POST' });

      expect(response.status).toBe(204);
      expect(runs.calls).toEqual(['stop run-1']);
    });

    it('should answer 409 when the run is not active', async () => {
      const runs = new FakeRunsPort();
      runs.stopFailure = new RunNotActiveError('Run run-1 is not running');

      const response = await createTestApp(runs).request('/runs/run-1/stop', { method: 'POST' });

      expect(response.status).toBe(409);
      expect(await response.json()).toEqual({ message: 'Run run-1 is not running' });
    });
  });
});
