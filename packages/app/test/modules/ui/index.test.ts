import { describe, expect, it } from 'vitest';
import { createUiModule, type WatcherPort } from '../../../src/modules/ui/index.js';
import type { SkillsStatus } from '../../../src/modules/skills/index.js';

const pendingWatcher: WatcherPort = {
  board: (projectId) => ({ projectId, sync: { state: 'pending' } }),
  ticket: async (projectId) => ({ projectId, sync: { state: 'pending' } }),
};

function createSubject(status: SkillsStatus) {
  return createUiModule({
    projects: { list: async () => [], add: async (checkoutPath) => notImplemented(checkoutPath) },
    skills: { status: () => status },
    watcher: pendingWatcher,
  });
}

function notImplemented(checkoutPath: string): never {
  throw new Error(`add(${checkoutPath}) was not expected to be called`);
}

describe('createUiModule', () => {
  it('should serve the skills status under /skills/status', async () => {
    const ui = createSubject({ state: 'pending' });

    const response = await ui.routes.request('/skills/status');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ state: 'pending' });
  });

  it('should serve the failure reason under /skills/status when the smoke test failed', async () => {
    const ui = createSubject({ state: 'failed', reason: 'claude exited with code 1' });

    const response = await ui.routes.request('/skills/status');

    expect(await response.json()).toEqual({ state: 'failed', reason: 'claude exited with code 1' });
  });

  it('should list the projects under /projects next to the board route', async () => {
    const ui = createSubject({ state: 'pending' });

    const response = await ui.routes.request('/projects');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
  });

  it('should serve the board under /projects/:owner/:name/board', async () => {
    const ui = createSubject({ state: 'pending' });

    const response = await ui.routes.request('/projects/owner/name/board');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ projectId: 'owner/name', sync: { state: 'pending' } });
  });

  it('should serve a ticket under /projects/:owner/:name/tickets/:number', async () => {
    const ui = createSubject({ state: 'pending' });

    const response = await ui.routes.request('/projects/owner/name/tickets/5');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ projectId: 'owner/name', sync: { state: 'pending' } });
  });
});
