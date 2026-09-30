import { describe, expect, it } from 'vitest';
import { stopTicketRun } from '../../src/tickets/stop-ticket-run.js';

type RequestRecord = { readonly url: string; readonly method: string | undefined };

function answerWith(status: number): () => Promise<Response> {
  return () => Promise.resolve(new Response(null, { status }));
}

describe('stopTicketRun', () => {
  it("should post to the run's stop route and return requested when the route answers 204", async () => {
    const requests: RequestRecord[] = [];
    const outcome = await stopTicketRun('run-1', (url, requestInit) => {
      requests.push({ url, method: requestInit.method });
      return answerWith(204)();
    });
    expect(requests).toEqual([{ url: '/api/runs/run-1/stop', method: 'POST' }]);
    expect(outcome).toEqual({ kind: 'requested' });
  });

  it('should return requested when the route answers 409 because the run already ended', async () => {
    expect(await stopTicketRun('run-1', answerWith(409))).toEqual({ kind: 'requested' });
  });

  it('should return failed when the route answers another error', async () => {
    expect(await stopTicketRun('run-1', answerWith(500))).toEqual({ kind: 'failed' });
  });

  it('should return failed when the request throws', async () => {
    const outcome = await stopTicketRun('run-1', () => Promise.reject(new TypeError('offline')));
    expect(outcome).toEqual({ kind: 'failed' });
  });
});
