import { describe, expect, it } from 'vitest';
import { answerCheckpoint } from '../../src/tickets/answer-checkpoint.js';

type RequestRecord = {
  readonly url: string;
  readonly method: string | undefined;
  readonly body: RequestInit['body'];
};

function answerWith(status: number, body: unknown): () => Promise<Response> {
  return () => Promise.resolve(new Response(JSON.stringify(body), { status }));
}

const resumedRun = { id: 'run-2', startedAt: '2026-10-04T10:00:00Z' };

describe('answerCheckpoint', () => {
  it("should post the answer as JSON to the run's checkpoint route when an answer is sent", async () => {
    const requests: RequestRecord[] = [];
    await answerCheckpoint('run-1', 'B. Leave archived runs out.', (url, requestInit) => {
      requests.push({ url, method: requestInit.method, body: requestInit.body });
      return answerWith(201, resumedRun)();
    });
    expect(requests).toEqual([
      {
        url: '/api/runs/run-1/checkpoint',
        method: 'POST',
        body: '{"answer":"B. Leave archived runs out."}',
      },
    ]);
  });

  it('should return answered when the route answers 201', async () => {
    const outcome = await answerCheckpoint('run-1', 'B.', answerWith(201, resumedRun));
    expect(outcome).toEqual({ kind: 'answered' });
  });

  it("should return failed with the server's message and the status when the route answers 409", async () => {
    const outcome = await answerCheckpoint(
      'run-1',
      'B.',
      answerWith(409, { message: 'The run is not waiting for an answer.' }),
    );
    expect(outcome).toEqual({
      kind: 'failed',
      message: 'The run is not waiting for an answer.',
      status: 409,
    });
  });

  it('should return failed without a status when the request throws', async () => {
    const outcome = await answerCheckpoint('run-1', 'B.', () =>
      Promise.reject(new TypeError('offline')),
    );
    expect(outcome).toEqual({ kind: 'failed', message: "Can't reach aisf." });
  });
});
