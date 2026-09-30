import { describe, expect, it } from 'vitest';
import { createUiModule } from '../../../src/modules/ui/index.js';

function createSubject() {
  return createUiModule({
    runs: {
      availability: async () => ({ kind: 'absent' }),
      activeRun: async () => undefined,
      latestRun: async () => undefined,
      start: async () => notExpected('start'),
      stop: async () => notExpected('stop'),
    },
  });
}

function notExpected(operation: string): never {
  throw new Error(`${operation} was not expected to be called`);
}

describe('createUiModule', () => {
  it('should serve a ticket run under /projects/:owner/:name/tickets/:number/run', async () => {
    const ui = createSubject();

    const response = await ui.routes.request('/projects/owner/name/tickets/5/run');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ availability: { kind: 'absent' } });
  });
});
