import { describe, expect, it } from 'vitest';
import { sendMessage } from './send-message.js';

function answerWith(status: number, body?: unknown): () => Promise<Response> {
  return () =>
    Promise.resolve(new Response(body === undefined ? null : JSON.stringify(body), { status }));
}

describe('sendMessage', () => {
  it("should post the text as JSON to the run's messages route when a message is sent", async () => {
    const requests: { url: string; method: string | undefined; body: RequestInit['body'] }[] = [];
    await sendMessage('run-1', 'hello', (url, requestInit) => {
      requests.push({ url, method: requestInit.method, body: requestInit.body });
      return answerWith(204)();
    });

    expect(requests).toEqual([
      { url: '/api/runs/run-1/messages', method: 'POST', body: '{"text":"hello"}' },
    ]);
  });

  it('should return sent when the route answers 204', async () => {
    const outcome = await sendMessage('run-1', 'hello', answerWith(204));

    expect(outcome).toEqual({ kind: 'sent' });
  });

  it('should return sent when the route answers 201', async () => {
    const outcome = await sendMessage('run-1', 'hello', answerWith(201, {}));

    expect(outcome).toEqual({ kind: 'sent' });
  });

  it('should return held with the resume time when the route answers 202', async () => {
    const outcome = await sendMessage(
      'run-1',
      'hello',
      answerWith(202, { held: true, pausedUntil: '2026-10-19T14:00:00Z' }),
    );

    expect(outcome).toEqual({ kind: 'held', pausedUntil: '2026-10-19T14:00:00Z' });
  });

  it("should return failed with the server's message and status when the route answers 409", async () => {
    const outcome = await sendMessage(
      'run-1',
      'hello',
      answerWith(409, { message: 'The run has ended.' }),
    );

    expect(outcome).toEqual({ kind: 'failed', message: 'The run has ended.', status: 409 });
  });

  it('should return failed without a status when the request throws', async () => {
    const outcome = await sendMessage('run-1', 'hello', () =>
      Promise.reject(new TypeError('offline')),
    );

    expect(outcome).toEqual({ kind: 'failed', message: "Can't reach aisf." });
  });
});
