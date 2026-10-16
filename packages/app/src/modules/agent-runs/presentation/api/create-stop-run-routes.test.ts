import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { FakeClock } from '../../../../shared/testing/fake-clock.js';
import { FakeEventPublisher } from '../../../../shared/testing/fake-event-publisher.js';
import { RunEndService } from '../../business/service/run-end-service.js';
import {
  buildRun,
  FakeAgentSessions,
  FakeRunAnswerWaits,
  FakeRunRepository,
} from '../../testing/fake-agent-runs-ports.js';
import { createStopRunRoutes } from './create-stop-run-routes.js';

function createTestApp(runRepository: FakeRunRepository, agentSessions: FakeAgentSessions): Hono {
  const runEndService = new RunEndService({
    runRepository,
    agentSessions,
    runAnswerWaits: new FakeRunAnswerWaits(),
    clock: new FakeClock('2026-09-29T11:00:00.000Z'),
    events: new FakeEventPublisher(),
  });
  return createStopRunRoutes(runEndService);
}

describe('createStopRunRoutes', () => {
  describe('POST /api/runs/:runId/stop', () => {
    it('should stop the run and answer 204 when the run is active', async () => {
      const runRepository = new FakeRunRepository();
      const agentSessions = new FakeAgentSessions();
      await runRepository.insert(buildRun({ id: 'run-1' }));

      const response = await createTestApp(runRepository, agentSessions).request(
        '/api/runs/run-1/stop',
        { method: 'POST' },
      );

      expect(response.status).toBe(204);
      expect(runRepository.runs.get('run-1')?.ending).toEqual({ kind: 'stopped' });
      expect(agentSessions.stoppedSessionIds).toEqual(['session-1']);
    });

    it('should answer 409 when the run is not active', async () => {
      const runRepository = new FakeRunRepository();

      const response = await createTestApp(runRepository, new FakeAgentSessions()).request(
        '/api/runs/run-1/stop',
        { method: 'POST' },
      );

      expect(response.status).toBe(409);
      expect(await response.json()).toEqual({ message: 'Run run-1 is not running' });
    });
  });
});
