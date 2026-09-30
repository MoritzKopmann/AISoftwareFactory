import { describe, expect, it } from 'vitest';
import { createUiModule, type WatcherPort } from '../../../src/modules/ui/index.js';

const pendingWatcher: WatcherPort = {
  board: (projectId) => ({ projectId, sync: { state: 'pending' } }),
  ticket: async (projectId) => ({ projectId, sync: { state: 'pending' } }),
};

function createSubject() {
  return createUiModule({
    watcher: pendingWatcher,
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
  it('should serve the board under /projects/:owner/:name/board', async () => {
    const ui = createSubject();

    const response = await ui.routes.request('/projects/owner/name/board');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ projectId: 'owner/name', sync: { state: 'pending' } });
  });

  it('should serve a ticket under /projects/:owner/:name/tickets/:number', async () => {
    const ui = createSubject();

    const response = await ui.routes.request('/projects/owner/name/tickets/5');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ projectId: 'owner/name', sync: { state: 'pending' } });
  });

  it('should serve a ticket run under /projects/:owner/:name/tickets/:number/run', async () => {
    const ui = createSubject();

    const response = await ui.routes.request('/projects/owner/name/tickets/5/run');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ availability: { kind: 'absent' } });
  });
});
