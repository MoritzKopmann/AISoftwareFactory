import { describe, expect, it } from 'vitest';
import { createTicketFromFinding } from '../../src/findings/create-ticket-from-finding.js';
import { buildFindingResponse } from './fixtures/finding-response.js';

type RequestRecord = { readonly url: string; readonly method: string | undefined };

const ticketed = buildFindingResponse({ id: 7, state: 'ticketed', createdTicketNumber: 212 });

function answerWith(status: number, body: unknown = ticketed): () => Promise<Response> {
  return () => Promise.resolve(new Response(JSON.stringify(body), { status }));
}

describe('createTicketFromFinding', () => {
  it("should post to the finding's ticket route and return the created ticket number when the route answers 200", async () => {
    const requests: RequestRecord[] = [];
    const outcome = await createTicketFromFinding(
      'MoritzKopmann/postkarte',
      7,
      (url, requestInit) => {
        requests.push({ url, method: requestInit.method });
        return answerWith(200)();
      },
    );

    expect(requests).toEqual([
      { url: '/api/projects/MoritzKopmann/postkarte/findings/7/ticket', method: 'POST' },
    ]);
    expect(outcome).toEqual({ kind: 'created', ticketNumber: 212 });
  });

  it('should keep the status when the route answers an error', async () => {
    const outcome = await createTicketFromFinding('o/n', 7, answerWith(409, { message: 'x' }));

    expect(outcome).toEqual({ kind: 'not-ok', status: 409 });
  });

  it('should keep the error message when the request throws', async () => {
    const outcome = await createTicketFromFinding('o/n', 7, () =>
      Promise.reject(new TypeError('Failed to fetch')),
    );

    expect(outcome).toEqual({ kind: 'unreachable', message: 'Failed to fetch' });
  });

  it('should fold the answer into unreachable when a 200 names no ticket', async () => {
    const outcome = await createTicketFromFinding(
      'o/n',
      7,
      answerWith(200, buildFindingResponse({ id: 7, state: 'ticketed' })),
    );

    expect(outcome).toEqual({ kind: 'unreachable', message: 'The answer names no ticket.' });
  });
});
