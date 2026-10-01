import { describe, expect, it } from 'vitest';
import { fetchFindings } from '../../src/findings/fetch-findings.js';
import { buildFindingResponse } from './fixtures/finding-response.js';

const findings = [buildFindingResponse({ id: 1 }), buildFindingResponse({ id: 2, kind: 'gap' })];

function answerWith(status: number, body: unknown = { findings }): () => Promise<Response> {
  return () => Promise.resolve(new Response(JSON.stringify(body), { status }));
}

describe('fetchFindings', () => {
  it("should ask for the findings under the project's owner and name", async () => {
    const requestedUrls: string[] = [];
    await fetchFindings('MoritzKopmann/postkarte', (url) => {
      requestedUrls.push(url);
      return answerWith(200)();
    });
    expect(requestedUrls).toEqual(['/api/projects/MoritzKopmann/postkarte/findings']);
  });

  it("should ask for only one ticket's findings when given a ticket number", async () => {
    const requestedUrls: string[] = [];
    await fetchFindings(
      'MoritzKopmann/postkarte',
      (url) => {
        requestedUrls.push(url);
        return answerWith(200)();
      },
      56,
    );
    expect(requestedUrls).toEqual(['/api/projects/MoritzKopmann/postkarte/findings?ticket=56']);
  });

  it('should return the findings as an answer when the route answers 200', async () => {
    expect(await fetchFindings('o/n', answerWith(200))).toEqual({ kind: 'answer', findings });
  });

  it('should keep the status when the route answers an error', async () => {
    expect(await fetchFindings('o/n', answerWith(500, { message: 'x' }))).toEqual({
      kind: 'not-ok',
      status: 500,
    });
  });

  it('should keep the error message when the request throws', async () => {
    const outcome = await fetchFindings('o/n', () =>
      Promise.reject(new TypeError('Failed to fetch')),
    );
    expect(outcome).toEqual({ kind: 'unreachable', message: 'Failed to fetch' });
  });

  it('should fold a body that is not JSON into unreachable', async () => {
    const outcome = await fetchFindings('o/n', () =>
      Promise.resolve(new Response('<html>', { status: 200 })),
    );
    expect(outcome.kind).toBe('unreachable');
  });
});
