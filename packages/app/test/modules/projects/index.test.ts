import { describe, expect, it } from 'vitest';
import { createProjectsModule } from '../../../src/modules/projects/index.js';
import { FakeClock } from '../../fakes/fake-clock.js';
import { FakeEventPublisher } from '../../fakes/fake-event-publisher.js';
import {
  FakeContractPreflight,
  FakeLabelSync,
  FakePluginInstaller,
  FakeProjectRepository,
  FakeRepositoryResolver,
} from './fakes/fake-projects-ports.js';

function createSubject() {
  return createProjectsModule({
    repositoryResolver: new FakeRepositoryResolver({ owner: 'owner', name: 'name' }),
    projectRepository: new FakeProjectRepository(),
    labelSync: new FakeLabelSync(),
    pluginInstaller: new FakePluginInstaller(),
    clock: new FakeClock('2026-01-01T00:00:00.000Z'),
    events: new FakeEventPublisher(),
    contractPreflight: new FakeContractPreflight(),
  });
}

describe('createProjectsModule', () => {
  it('should list the projects under /projects when none were added', async () => {
    const projects = createSubject();

    const response = await projects.routes.request('/projects');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
  });

  it('should list an added project under /projects when a checkout path is posted', async () => {
    const projects = createSubject();

    const created = await projects.routes.request('/projects', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ checkoutPath: '/repo' }),
    });
    const response = await projects.routes.request('/projects');

    expect(created.status).toBe(201);
    expect(await response.json()).toMatchObject([{ id: 'owner/name', checkoutPath: '/repo' }]);
  });
});
