import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { createProjectsRoutes } from '../../../../../src/modules/projects/api/routes/create-projects-routes.js';
import { CheckoutNotARepositoryError } from '../../../../../src/modules/projects/logic/errors/checkout-not-a-repository-error.js';
import { LabelSyncFailedError } from '../../../../../src/modules/projects/logic/errors/label-sync-failed-error.js';
import { RepositoryResolutionFailedError } from '../../../../../src/modules/projects/logic/errors/repository-resolution-failed-error.js';
import { AddProjectUseCase } from '../../../../../src/modules/projects/logic/use-cases/add-project-use-case.js';
import { ListProjectsUseCase } from '../../../../../src/modules/projects/logic/use-cases/list-projects-use-case.js';
import { FakeClock } from '../../../../fakes/fake-clock.js';
import { FakeEventPublisher } from '../../../../fakes/fake-event-publisher.js';
import {
  FakeContractPreflight,
  FakeLabelSync,
  FakePluginInstaller,
  FakeProjectRepository,
  FakeRepositoryResolver,
} from '../../fakes/fake-projects-ports.js';

const passingReport = {
  passed: true,
  missingSlots: [],
  missingHeadings: [],
  missingKeys: [],
};

function createSubject() {
  const repositoryResolver = new FakeRepositoryResolver({ owner: 'owner', name: 'name' });
  const projectRepository = new FakeProjectRepository();
  const labelSync = new FakeLabelSync();
  const pluginInstaller = new FakePluginInstaller();
  const app = new Hono().route(
    '/projects',
    createProjectsRoutes(
      new ListProjectsUseCase(projectRepository, new FakeContractPreflight()),
      new AddProjectUseCase({
        repositoryResolver,
        projectRepository,
        labelSync,
        pluginInstaller,
        clock: new FakeClock('2026-01-01T00:00:00.000Z'),
        events: new FakeEventPublisher(),
      }),
    ),
  );
  return { app, repositoryResolver, projectRepository, labelSync, pluginInstaller };
}

function postProject(app: Hono, contentType = 'application/json', body?: string) {
  return app.request('/projects', {
    method: 'POST',
    headers: { 'content-type': contentType },
    body: body ?? JSON.stringify({ checkoutPath: '/repo' }),
  });
}

describe('createProjectsRoutes', () => {
  it('should list the projects when GET / is requested', async () => {
    const { app } = createSubject();

    const response = await app.request('/projects');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
  });

  it('should answer 201 with the project when a checkout path is posted as JSON', async () => {
    const { app, projectRepository } = createSubject();

    const response = await postProject(app);

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ checkoutPath: '/repo' });
    expect(await projectRepository.list()).toHaveLength(1);
  });

  it("should include each project's contract report when listing", async () => {
    const { app } = createSubject();
    await postProject(app);

    const response = await app.request('/projects');

    expect(await response.json()).toMatchObject([{ contract: passingReport }]);
  });

  it('should answer 409 with a message and leave the list unchanged when the project already exists', async () => {
    const { app, projectRepository } = createSubject();
    await postProject(app);

    const response = await postProject(app);

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ message: 'owner/name has already been added' });
    expect(await projectRepository.list()).toHaveLength(1);
  });

  it('should answer 422 with a message when the checkout is not a GitHub repository', async () => {
    const { app, repositoryResolver } = createSubject();
    repositoryResolver.failure = new CheckoutNotARepositoryError(
      'Pick the folder that contains .git',
    );

    const response = await postProject(app);

    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({ message: 'Pick the folder that contains .git' });
  });

  it('should answer 502 with a message when the repository cannot be resolved', async () => {
    const { app, repositoryResolver } = createSubject();
    repositoryResolver.failure = new RepositoryResolutionFailedError('gh repo view failed');

    const response = await postProject(app);

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ message: 'gh repo view failed' });
  });

  it('should answer 502 with a message when the label sync fails', async () => {
    const { app, labelSync } = createSubject();
    labelSync.failure = new LabelSyncFailedError('gh: authentication required');

    const response = await postProject(app);

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ message: 'gh: authentication required' });
  });

  it('should answer 502 with a message when the plugin install fails', async () => {
    const { app, pluginInstaller } = createSubject();
    pluginInstaller.result = { state: 'failed', reason: 'claude plugin install failed: not found' };

    const response = await postProject(app);

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      message: 'claude plugin install failed: not found',
    });
  });

  it('should answer 415 and never call the use case when the content type is not JSON', async () => {
    const { app, repositoryResolver } = createSubject();

    const response = await postProject(app, 'text/plain', '/repo');

    expect(response.status).toBe(415);
    expect(repositoryResolver.resolveCalls).toHaveLength(0);
  });

  it('should answer 400 and never call the use case when the JSON body fails validation', async () => {
    const { app, repositoryResolver } = createSubject();

    const response = await postProject(app, 'application/json', JSON.stringify({}));

    expect(response.status).toBe(400);
    expect(repositoryResolver.resolveCalls).toHaveLength(0);
  });
});
