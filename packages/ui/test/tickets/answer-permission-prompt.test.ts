import { describe, expect, it } from 'vitest';
import { answerPermissionPrompt } from '../../src/tickets/answer-permission-prompt.js';

type RequestRecord = {
  readonly url: string;
  readonly method: string | undefined;
  readonly body: RequestInit['body'];
};

function answerWith(status: number, body: unknown): () => Promise<Response> {
  return () => Promise.resolve(new Response(JSON.stringify(body), { status }));
}

const resumedRun = { id: 'run-2', startedAt: '2026-09-30T10:00:00Z' };

describe('answerPermissionPrompt', () => {
  it("should post the decision as JSON to the run's permission route", async () => {
    const requests: RequestRecord[] = [];
    await answerPermissionPrompt('run-1', 'deny', (url, requestInit) => {
      requests.push({ url, method: requestInit.method, body: requestInit.body });
      return answerWith(201, resumedRun)();
    });
    expect(requests).toEqual([
      { url: '/api/runs/run-1/permission', method: 'POST', body: '{"decision":"deny"}' },
    ]);
  });

  it('should return answered when the route answers 201', async () => {
    const outcome = await answerPermissionPrompt('run-1', 'allow', answerWith(201, resumedRun));
    expect(outcome).toEqual({ kind: 'answered' });
  });

  it("should return failed with the server's message and the status when the route answers 409", async () => {
    const outcome = await answerPermissionPrompt(
      'run-1',
      'allow',
      answerWith(409, { message: 'This prompt was already answered.' }),
    );
    expect(outcome).toEqual({
      kind: 'failed',
      message: 'This prompt was already answered.',
      status: 409,
    });
  });

  it('should return failed without a status when the request throws', async () => {
    const outcome = await answerPermissionPrompt('run-1', 'allow', () =>
      Promise.reject(new TypeError('offline')),
    );
    expect(outcome).toEqual({ kind: 'failed', message: "Can't reach aisf." });
  });
});
