import { describe, expect, it } from 'vitest';
import { createProjectsModule } from './index.js';
import type { SkillsApi } from '../skills/index.js';
import { createLogger } from '../../shared/logger/create-logger.js';
import { FakeClock } from '../../shared/testing/fake-clock.js';
import { FakeEventPublisher } from '../../shared/testing/fake-event-publisher.js';
import {
  FakeLabelSync,
  FakeProjectRepository,
  FakeRepositoryResolver,
} from './testing/fake-projects-ports.js';

function createSubject(
  overrides: {
    readonly projectRepository?: FakeProjectRepository;
    readonly labelSync?: FakeLabelSync;
  } = {},
) {
  const skills: Pick<SkillsApi, 'runContractPreflight' | 'installPluginLocally'> = {
    runContractPreflight: async () => ({ passed: true, missingSlots: [], missingKeys: [] }),
    installPluginLocally: async () => ({ state: 'installed' }),
  };
  return createProjectsModule(
    {
      database: undefined as never,
      clock: new FakeClock('2026-01-01T00:00:00.000Z'),
      events: new FakeEventPublisher(),
      logger: createLogger(() => undefined),
      skills: skills as SkillsApi,
    },
    {
      repositoryResolver: new FakeRepositoryResolver({ owner: 'owner', name: 'name' }),
      projectRepository: overrides.projectRepository ?? new FakeProjectRepository(),
      labelSync: overrides.labelSync ?? new FakeLabelSync(),
    },
  );
}

describe('createProjectsModule', () => {
  it('should list the projects under /api/projects when none were added', async () => {
    const projects = createSubject();

    const response = await projects.routes.request('/api/projects');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
  });

  it('should list an added project under /api/projects when a checkout path is posted', async () => {
    const projects = createSubject();

    const created = await projects.routes.request('/api/projects', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ checkoutPath: '/repo' }),
    });
    const response = await projects.routes.request('/api/projects');

    expect(created.status).toBe(201);
    expect(await response.json()).toMatchObject([{ id: 'owner/name', checkoutPath: '/repo' }]);
  });

  it('should sync the labels of a registered project when the projects.sync-labels job runs', async () => {
    const projectRepository = new FakeProjectRepository();
    const labelSync = new FakeLabelSync();
    await projectRepository.save({
      id: 'owner/name',
      repository: { owner: 'owner', name: 'name' },
      checkoutPath: '/repo',
      addedAt: '2026-01-01T00:00:00.000Z',
      paused: false,
    });
    const projects = createSubject({ projectRepository, labelSync });

    await projects.jobs['projects.sync-labels']?.();

    expect(labelSync.syncCalls).toEqual([{ owner: 'owner', name: 'name' }]);
  });

  it('should show paused true in ProjectsApi.list when the project is paused', async () => {
    const projectRepository = new FakeProjectRepository();
    await projectRepository.save({
      id: 'owner/name',
      repository: { owner: 'owner', name: 'name' },
      checkoutPath: '/repo',
      addedAt: '2026-01-01T00:00:00.000Z',
      paused: true,
    });
    const projects = createSubject({ projectRepository });

    const list = await projects.internal.list();

    expect(list).toMatchObject([{ id: 'owner/name', paused: true }]);
  });
});
