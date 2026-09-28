import type { ProjectBoardResponse } from '@aisf/app/api-schemas/tickets-schemas.js';
import { describe, expect, it } from 'vitest';
import { fetchBoardOutcome } from '../../src/board/fetch-board-outcome.js';

const response: ProjectBoardResponse = { projectId: 'o/n', sync: { state: 'pending' } };

function answerWith(status: number, body: unknown = response): () => Promise<Response> {
  return () => Promise.resolve(new Response(JSON.stringify(body), { status }));
}

describe('fetchBoardOutcome', () => {
  it('should ask for the project board under its owner and name', async () => {
    const requestedUrls: string[] = [];
    await fetchBoardOutcome('MoritzKopmann/postkarte', (url) => {
      requestedUrls.push(url);
      return answerWith(200)();
    });
    expect(requestedUrls).toEqual(['/api/projects/MoritzKopmann/postkarte/board']);
  });

  it('should return the parsed response as an answer when the route answers 200', async () => {
    expect(await fetchBoardOutcome('o/n', answerWith(200))).toEqual({ kind: 'answer', response });
  });

  it('should return not-watched when the route answers 404', async () => {
    expect(await fetchBoardOutcome('o/n', answerWith(404, { message: 'x' }))).toEqual({
      kind: 'not-watched',
    });
  });

  it('should return request-failed when the route answers another error', async () => {
    expect(await fetchBoardOutcome('o/n', answerWith(500, { message: 'x' }))).toEqual({
      kind: 'request-failed',
    });
  });

  it('should return request-failed when the request throws', async () => {
    const outcome = await fetchBoardOutcome('o/n', () => Promise.reject(new TypeError('offline')));
    expect(outcome).toEqual({ kind: 'request-failed' });
  });

  it('should return request-failed when the body is not JSON', async () => {
    const outcome = await fetchBoardOutcome('o/n', () =>
      Promise.resolve(new Response('<html>', { status: 200 })),
    );
    expect(outcome).toEqual({ kind: 'request-failed' });
  });
});
