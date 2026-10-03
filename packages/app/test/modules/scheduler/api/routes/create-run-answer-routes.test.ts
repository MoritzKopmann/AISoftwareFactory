import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import {
  createRunAnswerRoutes,
  type RunAnswers,
} from '../../../../../src/modules/scheduler/api/routes/create-run-answer-routes.js';
import { startedRunResponseSchema } from '../../../../../src/modules/scheduler/api/schemas/runs-schemas.js';
import type { RunAnswer } from '../../../../../src/modules/scheduler/logic/domain/types/run-answer.js';
import { RunNotAnswerableError } from '../../../../../src/modules/scheduler/logic/errors/run-not-answerable-error.js';
import { RunAlreadyActiveError } from '../../../../../src/modules/scheduler/logic/errors/run-already-active-error.js';

class FakeRunAnswers implements RunAnswers {
  failure: Error | undefined;
  readonly calls: string[] = [];

  async answer(runId: string, answer: RunAnswer) {
    this.calls.push(`${runId} ${JSON.stringify(answer)}`);
    if (this.failure !== undefined) {
      throw this.failure;
    }
    return { id: 'run-2', startedAt: '2026-09-29T11:00:00.000Z' };
  }
}

function post(runAnswers: RunAnswers, body: unknown, path = 'permission'): Promise<Response> {
  return Promise.resolve(
    new Hono().route('/runs', createRunAnswerRoutes(runAnswers)).request(`/runs/run-1/${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
}

describe('createRunAnswerRoutes', () => {
  describe('POST /runs/:runId/permission', () => {
    it.each(['allow', 'deny'] as const)(
      'should answer 201 with the resumed run when the decision is %s',
      async (decision) => {
        const runAnswers = new FakeRunAnswers();

        const response = await post(runAnswers, { decision });

        expect(response.status).toBe(201);
        expect(startedRunResponseSchema.parse(await response.json())).toEqual({
          id: 'run-2',
          startedAt: '2026-09-29T11:00:00.000Z',
        });
        expect(runAnswers.calls).toEqual([
          `run-1 ${JSON.stringify({ kind: 'permission', decision })}`,
        ]);
      },
    );

    it.each([{ decision: 'maybe' }, {}, 'allow'])(
      'should answer 400 and answer nothing when the body is %j',
      async (body) => {
        const runAnswers = new FakeRunAnswers();

        const response = await post(runAnswers, body);

        expect(response.status).toBe(400);
        expect(runAnswers.calls).toEqual([]);
      },
    );

    it('should answer 400 when the body is not JSON', async () => {
      const runAnswers = new FakeRunAnswers();

      const response = await new Hono()
        .route('/runs', createRunAnswerRoutes(runAnswers))
        .request('/runs/run-1/permission', { method: 'POST', body: 'not json' });

      expect(response.status).toBe(400);
      expect(runAnswers.calls).toEqual([]);
    });

    it.each([
      new RunNotAnswerableError('#147 is not stuck'),
      new RunAlreadyActiveError('moritz/aisf already has a running run'),
    ])('should answer 409 with the message when the answer fails with %s', async (failure) => {
      const runAnswers = new FakeRunAnswers();
      runAnswers.failure = failure;

      const response = await post(runAnswers, { decision: 'allow' });

      expect(response.status).toBe(409);
      expect(await response.json()).toEqual({ message: failure.message });
    });
  });

  describe('POST /runs/:runId/checkpoint', () => {
    it('should answer 201 and pass the trimmed answer on when the answer has spaces around it', async () => {
      const runAnswers = new FakeRunAnswers();

      const response = await post(runAnswers, { answer: '  Looks good  ' }, 'checkpoint');

      expect(response.status).toBe(201);
      expect(await response.json()).toEqual({
        id: 'run-2',
        startedAt: '2026-09-29T11:00:00.000Z',
      });
      expect(runAnswers.calls).toEqual([
        `run-1 ${JSON.stringify({ kind: 'checkpoint', text: 'Looks good' })}`,
      ]);
    });

    it('should answer 201 when the answer is exactly 10000 characters', async () => {
      const response = await post(
        new FakeRunAnswers(),
        { answer: 'a'.repeat(10_000) },
        'checkpoint',
      );

      expect(response.status).toBe(201);
    });

    it.each([{ answer: '' }, { answer: '   ' }, { answer: 'a'.repeat(10_001) }, {}, { answer: 5 }])(
      'should answer 400 and answer nothing when the body is %j',
      async (body) => {
        const runAnswers = new FakeRunAnswers();

        const response = await post(runAnswers, body, 'checkpoint');

        expect(response.status).toBe(400);
        expect(await response.json()).toHaveProperty('message');
        expect(runAnswers.calls).toEqual([]);
      },
    );

    it('should answer 400 when the body is not JSON', async () => {
      const runAnswers = new FakeRunAnswers();

      const response = await new Hono()
        .route('/runs', createRunAnswerRoutes(runAnswers))
        .request('/runs/run-1/checkpoint', { method: 'POST', body: 'not json' });

      expect(response.status).toBe(400);
      expect(runAnswers.calls).toEqual([]);
    });

    it.each([
      new RunNotAnswerableError('#147 is not waiting'),
      new RunAlreadyActiveError('moritz/aisf already has a running run'),
    ])('should answer 409 with the message when the answer fails with %s', async (failure) => {
      const runAnswers = new FakeRunAnswers();
      runAnswers.failure = failure;

      const response = await post(runAnswers, { answer: 'Looks good' }, 'checkpoint');

      expect(response.status).toBe(409);
      expect(await response.json()).toEqual({ message: failure.message });
    });
  });
});
