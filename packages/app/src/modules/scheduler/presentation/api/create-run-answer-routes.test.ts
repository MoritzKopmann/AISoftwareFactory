import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import type { TicketRunService } from '../../business/service/ticket-run-service.js';
import { createRunAnswerRoutes } from './create-run-answer-routes.js';
import { heldAnswerResponseSchema, startedRunResponseSchema } from '../dto/api/runs-schemas.js';
import type { RunAnswerOutcome } from '../../business/domain/types/run-answer-outcome.js';
import type { RunAnswer } from '../../business/domain/types/run-answer.js';
import { RunNotAnswerableError } from '../../business/errors/run-not-answerable-error.js';
import type { SendMessageOutcome } from '../../business/domain/types/send-message-outcome.js';
import { RunAlreadyActiveError } from '../../business/errors/run-already-active-error.js';

type RunAnswers = Pick<TicketRunService, 'answer' | 'sendMessage'>;

class FakeRunAnswers implements RunAnswers {
  failure: Error | undefined;
  held = false;
  messageOutcome: SendMessageOutcome = { kind: 'pushed' };
  readonly calls: string[] = [];
  readonly messages: string[] = [];

  async sendMessage(runId: string, text: string): Promise<SendMessageOutcome> {
    this.messages.push(`${runId} ${text}`);
    if (this.failure !== undefined) {
      throw this.failure;
    }
    return this.messageOutcome;
  }

  async answer(runId: string, answer: RunAnswer): Promise<RunAnswerOutcome> {
    this.calls.push(`${runId} ${JSON.stringify(answer)}`);
    if (this.failure !== undefined) {
      throw this.failure;
    }
    if (this.held) {
      return { kind: 'held', pausedUntil: '2026-10-18T15:00:00.000Z' };
    }
    return { kind: 'answered', run: { id: 'run-2', startedAt: '2026-09-29T11:00:00.000Z' } };
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
  it.each([
    ['permission', { decision: 'allow' }],
    ['checkpoint', { answer: 'yes' }],
  ])('should answer 202 with the reset time when the %s answer is held', async (path, body) => {
    const runAnswers = new FakeRunAnswers();
    runAnswers.held = true;

    const response = await post(runAnswers, body, path);

    expect(response.status).toBe(202);
    expect(heldAnswerResponseSchema.parse(await response.json())).toEqual({
      held: true,
      pausedUntil: '2026-10-18T15:00:00.000Z',
    });
  });

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

  describe('POST /runs/:runId/messages', () => {
    it('should answer 204 and pass the trimmed text on when the message is pushed', async () => {
      const runAnswers = new FakeRunAnswers();

      const response = await post(runAnswers, { text: ' hello ' }, 'messages');

      expect(response.status).toBe(204);
      expect(await response.text()).toBe('');
      expect(runAnswers.messages).toEqual(['run-1 hello']);
    });

    it('should answer 201 with the resumed run when the message resumed the run', async () => {
      const runAnswers = new FakeRunAnswers();
      runAnswers.messageOutcome = {
        kind: 'resumed',
        run: { id: 'run-2', startedAt: '2026-09-29T11:00:00.000Z' },
      };

      const response = await post(runAnswers, { text: 'hello' }, 'messages');

      expect(response.status).toBe(201);
      expect(startedRunResponseSchema.parse(await response.json())).toEqual({
        id: 'run-2',
        startedAt: '2026-09-29T11:00:00.000Z',
      });
    });

    it('should answer 202 with the reset time when the message is held', async () => {
      const runAnswers = new FakeRunAnswers();
      runAnswers.messageOutcome = { kind: 'held', pausedUntil: '2026-10-18T15:00:00.000Z' };

      const response = await post(runAnswers, { text: 'hello' }, 'messages');

      expect(response.status).toBe(202);
      expect(heldAnswerResponseSchema.parse(await response.json())).toEqual({
        held: true,
        pausedUntil: '2026-10-18T15:00:00.000Z',
      });
    });

    it.each([{ text: '   ' }, { text: '' }, { text: 'a'.repeat(10_001) }, {}, { text: 5 }])(
      'should answer 400 and send nothing when the body is %j',
      async (body) => {
        const runAnswers = new FakeRunAnswers();

        const response = await post(runAnswers, body, 'messages');

        expect(response.status).toBe(400);
        expect(await response.json()).toHaveProperty('message');
        expect(runAnswers.messages).toEqual([]);
      },
    );

    it('should answer 204 when the text is exactly 10000 characters', async () => {
      const response = await post(new FakeRunAnswers(), { text: 'a'.repeat(10_000) }, 'messages');

      expect(response.status).toBe(204);
    });

    it('should answer 409 with the message when the run is not answerable', async () => {
      const runAnswers = new FakeRunAnswers();
      runAnswers.failure = new RunNotAnswerableError('#147 is not running');

      const response = await post(runAnswers, { text: 'hello' }, 'messages');

      expect(response.status).toBe(409);
      expect(await response.json()).toEqual({ message: '#147 is not running' });
    });
  });
});
