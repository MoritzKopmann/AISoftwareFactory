import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { createProjectsRoutes } from '../../../../../src/modules/ui/api/routes/create-projects-routes.js';
import {
  CheckoutNotARepositoryError,
  GitHubCliError,
  PluginInstallFailedError,
  ProjectAlreadyAddedError,
  type Project,
} from '../../../../../src/modules/projects/index.js';
import type { ProjectsPort } from '../../../../../src/modules/ui/index.js';

class FakeProjects implements ProjectsPort {
  private readonly projects: Project[] = [];
  readonly addCalls: string[] = [];
  failure: Error | undefined;

  async list(): Promise<ReadonlyArray<Project>> {
    return this.projects;
  }

  async add(checkoutPath: string): Promise<Project> {
    this.addCalls.push(checkoutPath);
    if (this.failure !== undefined) {
      throw this.failure;
    }
    const project: Project = {
      id: 'owner/name',
      repository: { owner: 'owner', name: 'name' },
      checkoutPath,
      addedAt: '2026-01-01T00:00:00.000Z',
    };
    this.projects.push(project);
    return project;
  }
}

function createTestApp(projects: ProjectsPort): Hono {
  return new Hono().route('/projects', createProjectsRoutes(projects));
}

describe('createProjectsRoutes', () => {
  it('should list the projects when GET / is requested', async () => {
    const projects = new FakeProjects();

    const response = await createTestApp(projects).request('/projects');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
  });

  it('should answer 201 with the project when a checkout path is posted as JSON', async () => {
    const projects = new FakeProjects();

    const response = await createTestApp(projects).request('/projects', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ checkoutPath: '/repo' }),
    });

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ checkoutPath: '/repo' });
    expect(await projects.list()).toHaveLength(1);
  });

  it('should answer 409 with a message and leave the list unchanged when the project already exists', async () => {
    const projects = new FakeProjects();
    projects.failure = new ProjectAlreadyAddedError('owner/name has already been added');

    const response = await createTestApp(projects).request('/projects', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ checkoutPath: '/repo' }),
    });

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ message: 'owner/name has already been added' });
    expect(await projects.list()).toHaveLength(0);
  });

  it('should answer 422 with a message when the checkout is not a GitHub repository', async () => {
    const projects = new FakeProjects();
    projects.failure = new CheckoutNotARepositoryError('Pick the folder that contains .git');

    const response = await createTestApp(projects).request('/projects', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ checkoutPath: '/repo' }),
    });

    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({ message: 'Pick the folder that contains .git' });
  });

  it('should answer 502 with a message when the gh CLI fails', async () => {
    const projects = new FakeProjects();
    projects.failure = new GitHubCliError('gh: authentication required');

    const response = await createTestApp(projects).request('/projects', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ checkoutPath: '/repo' }),
    });

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ message: 'gh: authentication required' });
  });

  it('should answer 502 with a message when the plugin install fails', async () => {
    const projects = new FakeProjects();
    projects.failure = new PluginInstallFailedError('claude plugin install failed: not found');

    const response = await createTestApp(projects).request('/projects', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ checkoutPath: '/repo' }),
    });

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      message: 'claude plugin install failed: not found',
    });
  });

  it('should answer 415 and never call the use case when the content type is not JSON', async () => {
    const projects = new FakeProjects();

    const response = await createTestApp(projects).request('/projects', {
      method: 'POST',
      headers: { 'content-type': 'text/plain' },
      body: '/repo',
    });

    expect(response.status).toBe(415);
    expect(projects.addCalls).toHaveLength(0);
  });

  it('should answer 400 and never call the use case when the JSON body fails validation', async () => {
    const projects = new FakeProjects();

    const response = await createTestApp(projects).request('/projects', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(response.status).toBe(400);
    expect(projects.addCalls).toHaveLength(0);
  });
});
