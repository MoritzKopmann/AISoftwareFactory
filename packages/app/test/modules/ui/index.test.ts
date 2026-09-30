import { describe, expect, it } from 'vitest';
import { createUiModule } from '../../../src/modules/ui/index.js';

describe('createUiModule', () => {
  it('should serve the stop route under /runs/:runId/stop', async () => {
    const stoppedRunIds: string[] = [];
    const ui = createUiModule({
      runs: {
        stop: async (runId) => {
          stoppedRunIds.push(runId);
        },
      },
    });

    const response = await ui.routes.request('/runs/run-1/stop', { method: 'POST' });

    expect(response.status).toBe(204);
    expect(stoppedRunIds).toEqual(['run-1']);
  });
});
