import type { RunLogResponse } from '@aisf/app/api-schemas/run-log-schemas.js';
import { describe, expect, it } from 'vitest';
import { fetchRunLog } from '../../src/tickets/fetch-run-log.js';

const response: RunLogResponse = {
  kind: 'found',
  entries: [{ summary: 'Read the ticket #56' }],
  total: 1,
};

function answerWith(status: number, body: unknown = response): () => Promise<Response> {
  return () => Promise.resolve(new Response(JSON.stringify(body), { status }));
}

describe('fetchRunLog', () => {
  it("should ask for the ticket's run log under the project's owner and name", async () => {
    const requestedUrls: string[] = [];
    await fetchRunLog('MoritzKopmann/postkarte', 56, (url) => {
      requestedUrls.push(url);
      return answerWith(200)();
    });
    expect(requestedUrls).toEqual(['/api/projects/MoritzKopmann/postkarte/tickets/56/run-log']);
  });

  it('should return the parsed response as an answer when the route answers 200', async () => {
    expect(await fetchRunLog('o/n', 56, answerWith(200))).toEqual({ kind: 'answer', response });
  });

  it('should return answered-error with the status when the route answers an error', async () => {
    expect(await fetchRunLog('o/n', 56, answerWith(500, { message: 'x' }))).toEqual({
      kind: 'answered-error',
      status: 500,
    });
  });

  it("should return request-failed with the error's message when the request throws", async () => {
    const outcome = await fetchRunLog('o/n', 56, () =>
      Promise.reject(new TypeError('Failed to fetch')),
    );
    expect(outcome).toEqual({ kind: 'request-failed', message: 'Failed to fetch' });
  });

  it('should return request-failed when the body is not JSON', async () => {
    const outcome = await fetchRunLog('o/n', 56, () =>
      Promise.resolve(new Response('<html>', { status: 200 })),
    );
    expect(outcome.kind).toBe('request-failed');
  });
});
