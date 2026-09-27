import { describe, expect, it } from 'vitest';
import { createUiModule } from '../../../src/modules/ui/index.js';
import type { SkillsStatus } from '../../../src/modules/skills/index.js';

function createSubject(status: SkillsStatus) {
  return createUiModule({
    projects: { list: async () => [], add: async (checkoutPath) => notImplemented(checkoutPath) },
    skills: { status: () => status },
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
});
