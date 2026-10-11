import { describe, expect, it } from 'vitest';
import { fetchNeedsYou } from '../../src/board/fetch-needs-you.js';

describe('fetchNeedsYou', () => {
  it('should get the project needs-you route and return the answer when it answers 200', async () => {
    const urls: string[] = [];
    const outcome = await fetchNeedsYou('o/n', (url) => {
      urls.push(url);
      return Promise.resolve(new Response(JSON.stringify({ rows: [] }), { status: 200 }));
    });
    expect(urls).toEqual(['/api/projects/o/n/needs-you']);
    expect(outcome).toEqual({ kind: 'answer', response: { rows: [] } });
  });

  it('should return request-failed with the status as detail when the route answers an error', async () => {
    const outcome = await fetchNeedsYou('o/n', () =>
      Promise.resolve(new Response('{}', { status: 502, statusText: 'Bad Gateway' })),
    );
    expect(outcome).toEqual({
      kind: 'request-failed',
      detail: 'GET /needs-you · 502 Bad Gateway',
    });
  });

  it('should return request-failed with the error message as detail when the request throws', async () => {
    const outcome = await fetchNeedsYou('o/n', () => Promise.reject(new Error('offline')));
    expect(outcome).toEqual({ kind: 'request-failed', detail: 'GET /needs-you · offline' });
  });
});
