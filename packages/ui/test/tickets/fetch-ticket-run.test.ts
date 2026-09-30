import type { TicketRunResponse } from '@aisf/app/api-schemas/runs-schemas.js';
import { describe, expect, it } from 'vitest';
import { fetchTicketRun } from '../../src/tickets/fetch-ticket-run.js';

const response: TicketRunResponse = { availability: { kind: 'available' } };

function answerWith(status: number, body: unknown = response): () => Promise<Response> {
  return () => Promise.resolve(new Response(JSON.stringify(body), { status }));
}

describe('fetchTicketRun', () => {
  it("should ask for the ticket's run under the project's owner and name", async () => {
    const requestedUrls: string[] = [];
    await fetchTicketRun('MoritzKopmann/postkarte', 56, (url) => {
      requestedUrls.push(url);
      return answerWith(200)();
    });
    expect(requestedUrls).toEqual(['/api/projects/MoritzKopmann/postkarte/tickets/56/run']);
  });

  it('should return the parsed response as an answer when the route answers 200', async () => {
    expect(await fetchTicketRun('o/n', 56, answerWith(200))).toEqual({ kind: 'answer', response });
  });

  it('should return request-failed when the route answers an error', async () => {
    expect(await fetchTicketRun('o/n', 56, answerWith(500, { message: 'x' }))).toEqual({
      kind: 'request-failed',
    });
  });

  it('should return request-failed when the request throws', async () => {
    const outcome = await fetchTicketRun('o/n', 56, () => Promise.reject(new TypeError('offline')));
    expect(outcome).toEqual({ kind: 'request-failed' });
  });

  it('should return request-failed when the body is not JSON', async () => {
    const outcome = await fetchTicketRun('o/n', 56, () =>
      Promise.resolve(new Response('<html>', { status: 200 })),
    );
    expect(outcome).toEqual({ kind: 'request-failed' });
  });
});
