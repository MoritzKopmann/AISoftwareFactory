import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import {
  createPermissionRoutes,
  type PermissionAnswers,
} from '../../../../../src/modules/scheduler/api/routes/create-permission-routes.js';
import { startedRunResponseSchema } from '../../../../../src/modules/scheduler/api/schemas/runs-schemas.js';
import type { PermissionDecision } from '../../../../../src/modules/scheduler/logic/domain/types/permission-decision.js';
import { PermissionNotAnswerableError } from '../../../../../src/modules/scheduler/logic/errors/permission-not-answerable-error.js';
import { RunAlreadyActiveError } from '../../../../../src/modules/scheduler/logic/errors/run-already-active-error.js';

class FakePermissionAnswers implements PermissionAnswers {
  failure: Error | undefined;
  readonly calls: string[] = [];

  async answer(runId: string, decision: PermissionDecision) {
    this.calls.push(`${runId} ${decision}`);
    if (this.failure !== undefined) {
      throw this.failure;
    }
    return { id: 'run-2', startedAt: '2026-09-29T11:00:00.000Z' };
  }
}

function post(permissionAnswers: PermissionAnswers, body: unknown): Promise<Response> {
  return Promise.resolve(
    new Hono()
      .route('/runs', createPermissionRoutes(permissionAnswers))
      .request('/runs/run-1/permission', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      }),
  );
}

describe('createPermissionRoutes', () => {
  describe('POST /runs/:runId/permission', () => {
    it.each(['allow', 'deny'] as const)(
      'should answer 201 with the resumed run when the decision is %s',
      async (decision) => {
        const permissionAnswers = new FakePermissionAnswers();

        const response = await post(permissionAnswers, { decision });

        expect(response.status).toBe(201);
        expect(startedRunResponseSchema.parse(await response.json())).toEqual({
          id: 'run-2',
          startedAt: '2026-09-29T11:00:00.000Z',
        });
        expect(permissionAnswers.calls).toEqual([`run-1 ${decision}`]);
      },
    );

    it.each([{ decision: 'maybe' }, {}, 'allow'])(
      'should answer 400 and answer nothing when the body is %j',
      async (body) => {
        const permissionAnswers = new FakePermissionAnswers();

        const response = await post(permissionAnswers, body);

        expect(response.status).toBe(400);
        expect(permissionAnswers.calls).toEqual([]);
      },
    );

    it('should answer 400 when the body is not JSON', async () => {
      const permissionAnswers = new FakePermissionAnswers();

      const response = await new Hono()
        .route('/runs', createPermissionRoutes(permissionAnswers))
        .request('/runs/run-1/permission', { method: 'POST', body: 'not json' });

      expect(response.status).toBe(400);
      expect(permissionAnswers.calls).toEqual([]);
    });

    it.each([
      new PermissionNotAnswerableError('#147 is not stuck'),
      new RunAlreadyActiveError('moritz/aisf already has a running run'),
    ])('should answer 409 with the message when the answer fails with %s', async (failure) => {
      const permissionAnswers = new FakePermissionAnswers();
      permissionAnswers.failure = failure;

      const response = await post(permissionAnswers, { decision: 'allow' });

      expect(response.status).toBe(409);
      expect(await response.json()).toEqual({ message: failure.message });
    });
  });
});
