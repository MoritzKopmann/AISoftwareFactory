import { describe, expect, it } from 'vitest';
import { RunnerModuleActiveRunLookup } from '../../../../../src/modules/tickets/infra/integrations/runner-module-active-run-lookup.js';
import { buildRun } from '../../../runner/fakes/fake-runner-ports.js';
import { FakeRunnerActiveRuns } from '../../fakes/fake-runner-active-runs.js';

describe('RunnerModuleActiveRunLookup', () => {
  describe('activeRunTicketNumbers', () => {
    it('should return the ticket number of each active run when runs are active', async () => {
      const runner = new FakeRunnerActiveRuns([
        { run: buildRun({ ticketNumber: 3 }), steps: [] },
        { run: buildRun({ ticketNumber: 7 }), steps: [] },
      ]);
      const lookup = new RunnerModuleActiveRunLookup(() => runner);

      expect(await lookup.activeRunTicketNumbers('p1')).toEqual([3, 7]);
      expect(runner.requestedProjectIds).toEqual(['p1']);
    });
  });
});
