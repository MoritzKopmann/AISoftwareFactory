import { describe, expect, it } from 'vitest';
import { startTicketRun } from '../../src/tickets/start-ticket-run.js';

type RequestRecord = { readonly url: string; readonly method: string | undefined };

function answerWith(status: number, body: unknown): () => Promise<Response> {
  return () => Promise.resolve(new Response(JSON.stringify(body), { status }));
}

describe('startTicketRun', () => {
  it("should post to the ticket's runs under the project's owner and name", async () => {
    const requests: RequestRecord[] = [];
    await startTicketRun('MoritzKopmann/postkarte', 56, (url, requestInit) => {
      requests.push({ url, method: requestInit.method });
      return answerWith(201, { id: 'run-1', startedAt: '2026-09-30T10:00:00Z' })();
    });
    expect(requests).toEqual([
      { url: '/api/projects/MoritzKopmann/postkarte/tickets/56/runs', method: 'POST' },
    ]);
  });

  it('should return started when the route answers 201', async () => {
    const outcome = await startTicketRun(
      'o/n',
      56,
      answerWith(201, { id: 'run-1', startedAt: '2026-09-30T10:00:00Z' }),
    );
    expect(outcome).toEqual({ kind: 'started' });
  });

  it("should return failed with the server's message and the status when the route answers 409", async () => {
    const outcome = await startTicketRun(
      'o/n',
      56,
      answerWith(409, { message: 'Another run started first; #42 is running.' }),
    );
    expect(outcome).toEqual({
      kind: 'failed',
      message: 'Another run started first; #42 is running.',
      status: 409,
    });
  });

  it('should return failed with an empty message and the status when the error body has no message', async () => {
    const outcome = await startTicketRun('o/n', 56, () =>
      Promise.resolve(new Response('<html>', { status: 500 })),
    );
    expect(outcome).toEqual({ kind: 'failed', message: '', status: 500 });
  });

  it('should return failed without a status when the request throws', async () => {
    const outcome = await startTicketRun('o/n', 56, () => Promise.reject(new TypeError('offline')));
    expect(outcome).toEqual({ kind: 'failed', message: "Can't reach aisf." });
  });
});
