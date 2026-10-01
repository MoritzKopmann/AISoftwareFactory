import { describe, expect, it } from 'vitest';
import { dismissFinding } from '../../src/findings/dismiss-finding.js';

type RequestRecord = { readonly url: string; readonly method: string | undefined };

function answerWith(status: number): () => Promise<Response> {
  return () => Promise.resolve(new Response('{}', { status }));
}

describe('dismissFinding', () => {
  it("should post to the finding's dismiss route and return dismissed when the route answers 200", async () => {
    const requests: RequestRecord[] = [];
    const outcome = await dismissFinding('MoritzKopmann/postkarte', 7, (url, requestInit) => {
      requests.push({ url, method: requestInit.method });
      return answerWith(200)();
    });

    expect(requests).toEqual([
      { url: '/api/projects/MoritzKopmann/postkarte/findings/7/dismiss', method: 'POST' },
    ]);
    expect(outcome).toEqual({ kind: 'dismissed' });
  });

  it('should keep the status when the route answers an error', async () => {
    expect(await dismissFinding('o/n', 7, answerWith(409))).toEqual({
      kind: 'not-ok',
      status: 409,
    });
  });

  it('should keep the error message when the request throws', async () => {
    const outcome = await dismissFinding('o/n', 7, () =>
      Promise.reject(new TypeError('Failed to fetch')),
    );

    expect(outcome).toEqual({ kind: 'unreachable', message: 'Failed to fetch' });
  });
});
