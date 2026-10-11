import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import {
  createIdeaRoutes,
  type IdeaSessions,
} from '../../../../../src/modules/scheduler/api/routes/create-idea-routes.js';
import {
  ideaResponseSchema,
  ideaRunNotStartedResponseSchema,
} from '../../../../../src/modules/scheduler/api/schemas/ideas-schemas.js';
import { IdeaRunNotStartedError } from '../../../../../src/modules/scheduler/logic/errors/idea-run-not-started-error.js';
import { ProjectNotFoundError } from '../../../../../src/modules/scheduler/logic/errors/project-not-found-error.js';
import { RunNotAvailableError } from '../../../../../src/modules/scheduler/logic/errors/run-not-available-error.js';

class FakeIdeaSessions implements IdeaSessions {
  failure: Error | undefined;
  readonly calls: string[] = [];

  async start(projectId: string, title: string): Promise<number> {
    this.calls.push(`start ${projectId} ${title}`);
    if (this.failure !== undefined) {
      throw this.failure;
    }
    return 501;
  }
}

async function post(ideaSessions: IdeaSessions, body: unknown): Promise<Response> {
  return new Hono()
    .route('/projects', createIdeaRoutes(ideaSessions))
    .request('/projects/owner/name/ideas', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
}

describe('createIdeaRoutes', () => {
  it('should answer 201 with the ticket number when the session starts', async () => {
    const ideaSessions = new FakeIdeaSessions();

    const response = await post(ideaSessions, { title: '  Export trips as postcards ' });

    expect(response.status).toBe(201);
    expect(ideaResponseSchema.parse(await response.json())).toEqual({ ticketNumber: 501 });
    expect(ideaSessions.calls).toEqual(['start owner/name Export trips as postcards']);
  });

  it('should answer 201 and pass the whole text on when the idea is longer than a title', async () => {
    const ideaSessions = new FakeIdeaSessions();
    const text = 'x'.repeat(10_000);

    const response = await post(ideaSessions, { title: text });

    expect(response.status).toBe(201);
    expect(ideaSessions.calls).toEqual([`start owner/name ${text}`]);
  });

  it.each([{ title: '   ' }, { title: 'x'.repeat(10_001) }, {}])(
    'should answer 400 and start nothing when the body is %j',
    async (body) => {
      const ideaSessions = new FakeIdeaSessions();

      const response = await post(ideaSessions, body);

      expect(response.status).toBe(400);
      expect(ideaSessions.calls).toEqual([]);
    },
  );

  it('should answer 404 when the project is unknown', async () => {
    const ideaSessions = new FakeIdeaSessions();
    ideaSessions.failure = new ProjectNotFoundError('unknown');

    expect((await post(ideaSessions, { title: 'x' })).status).toBe(404);
  });

  it('should answer 409 when the run is not available', async () => {
    const ideaSessions = new FakeIdeaSessions();
    ideaSessions.failure = new RunNotAvailableError('Usage limit');

    const response = await post(ideaSessions, { title: 'x' });

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ message: 'Usage limit' });
  });

  it('should answer 409 with the ticket number when the issue exists but the run did not start', async () => {
    const ideaSessions = new FakeIdeaSessions();
    ideaSessions.failure = new IdeaRunNotStartedError(501, 'boom');

    const response = await post(ideaSessions, { title: 'x' });

    expect(response.status).toBe(409);
    expect(ideaRunNotStartedResponseSchema.parse(await response.json())).toEqual({
      message: 'boom',
      ticketNumber: 501,
    });
  });
});
