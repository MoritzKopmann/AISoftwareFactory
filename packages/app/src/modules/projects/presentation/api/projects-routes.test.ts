import type { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { createProjectsRoutes } from './projects-routes.js';
import { CheckoutNotARepositoryError } from '../../business/errors/checkout-not-a-repository-error.js';
import { GitHubCliError } from '../../business/errors/github-cli-error.js';
import { ProjectService } from '../../business/service/project-service.js';
import { FakeClock } from '../../../../shared/testing/fake-clock.js';
import { FakeEventPublisher } from '../../../../shared/testing/fake-event-publisher.js';
import {
  FakeLabelSync,
  FakeSkillPort,
  FakeProjectRepository,
  FakeRepositoryResolver,
} from '../../testing/fake-projects-ports.js';

const passingReport = {
  passed: true,
  missingSlots: [],
  missingKeys: [],
};

function createSubject() {
  const repositoryResolver = new FakeRepositoryResolver({ owner: 'owner', name: 'name' });
  const projectRepository = new FakeProjectRepository();
  const labelSync = new FakeLabelSync();
  const skillPort = new FakeSkillPort();
  const app = createProjectsRoutes(
    new ProjectService({
      repositoryResolver,
      projectRepository,
      labelSync,
      skillPort,
      clock: new FakeClock('2026-01-01T00:00:00.000Z'),
      events: new FakeEventPublisher(),
    }),
  );
  return { app, repositoryResolver, projectRepository, labelSync, skillPort };
}

function postProject(app: Hono, contentType = 'application/json', body?: string) {
  return app.request('/api/projects', {
    method: 'POST',
    headers: { 'content-type': contentType },
    body: body ?? JSON.stringify({ checkoutPath: '/repo' }),
  });
}

describe('createProjectsRoutes', () => {
  it('should list the projects when GET / is requested', async () => {
    const { app } = createSubject();

    const response = await app.request('/api/projects');

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

    const response = await app.request('/api/projects');

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

  it('should answer 502 with a message when the gh CLI fails', async () => {
    const { app, labelSync } = createSubject();
    labelSync.failure = new GitHubCliError('gh: authentication required');

    const response = await postProject(app);

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ message: 'gh: authentication required' });
  });

  it('should answer 502 with a message when the plugin install fails', async () => {
    const { app, skillPort } = createSubject();
    skillPort.result = { state: 'failed', reason: 'claude plugin install failed: not found' };

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

  it('should show paused true in the list when the project is paused', async () => {
    const { app, projectRepository } = createSubject();
    await postProject(app);
    await projectRepository.setPaused('owner/name', true);

    const response = await app.request('/api/projects');

    expect(await response.json()).toMatchObject([{ paused: true }]);
  });

  it('should show paused false in the 201 body when a project is added', async () => {
    const { app } = createSubject();

    const response = await postProject(app);

    expect(await response.json()).toMatchObject({ paused: false });
  });

  describe('PATCH /api/projects/:owner/:name', () => {
    function patchProject(
      app: Hono,
      path: string,
      body: unknown,
      contentType = 'application/json',
    ) {
      return app.request(path, {
        method: 'PATCH',
        headers: { 'content-type': contentType },
        body: typeof body === 'string' ? body : JSON.stringify(body),
      });
    }

    it('should answer 200 with the paused project when paused is set to true', async () => {
      const { app } = createSubject();
      await postProject(app);

      const response = await patchProject(app, '/api/projects/owner/name', { paused: true });

      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({
        id: 'owner/name',
        paused: true,
        contract: passingReport,
      });
    });

    it('should answer 400 and leave the project unchanged when paused is not a boolean', async () => {
      const { app, projectRepository } = createSubject();
      await postProject(app);

      const response = await patchProject(app, '/api/projects/owner/name', { paused: 'yes' });

      expect(response.status).toBe(400);
      expect((await projectRepository.findById('owner/name'))?.paused).toBe(false);
    });

    it('should answer 415 when the content type is not JSON', async () => {
      const { app } = createSubject();
      await postProject(app);

      const response = await patchProject(app, '/api/projects/owner/name', 'x', 'text/plain');

      expect(response.status).toBe(415);
    });

    it('should keep the checkout path when the body also carries one', async () => {
      const { app, projectRepository } = createSubject();
      await postProject(app);

      await patchProject(app, '/api/projects/owner/name', {
        paused: true,
        checkoutPath: '/other',
      });

      expect((await projectRepository.findById('owner/name'))?.checkoutPath).toBe('/repo');
    });

    it('should answer 404 with a message when the project is unknown', async () => {
      const { app } = createSubject();

      const response = await patchProject(app, '/api/projects/owner/missing', { paused: true });

      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({
        message: 'owner/missing is not a registered project',
      });
    });
  });
});
