import { describe, expect, it } from 'vitest';
import { startIdeaSession } from '../../src/projects/start-idea-session.js';

const answer = (status: number, body: unknown) => () =>
  Promise.resolve(new Response(JSON.stringify(body), { status }));

describe('startIdeaSession', () => {
  it('should post the text to the ideas route when called', async () => {
    const seen: { url: string; method: string | undefined; body: unknown }[] = [];
    await startIdeaSession('o/n', 'Export trips', (url, init) => {
      seen.push({ url, method: init.method, body: init.body });
      return answer(201, { ticketNumber: 12 })();
    });
    expect(seen).toEqual([
      {
        url: '/api/projects/o/n/ideas',
        method: 'POST',
        body: JSON.stringify({ text: 'Export trips' }),
      },
    ]);
  });

  it('should return started with the ticket number when the route answers 201', async () => {
    expect(await startIdeaSession('o/n', 'x', answer(201, { ticketNumber: 12 }))).toEqual({
      kind: 'started',
      ticketNumber: 12,
    });
  });

  it('should return failed with message and ticket number when the route answers 409', async () => {
    expect(
      await startIdeaSession('o/n', 'x', answer(409, { message: 'Busy', ticketNumber: 12 })),
    ).toEqual({ kind: 'failed', message: 'Busy', ticketNumber: 12 });
  });

  it('should return failed without a ticket number when the route answers without one', async () => {
    expect(await startIdeaSession('o/n', 'x', answer(500, { message: 'Boom' }))).toEqual({
      kind: 'failed',
      message: 'Boom',
    });
  });

  it('should return failed when the request throws', async () => {
    const outcome = await startIdeaSession('o/n', 'x', () => Promise.reject(new Error('off')));
    expect(outcome).toEqual({ kind: 'failed', message: "Can't reach aisf." });
  });
});
