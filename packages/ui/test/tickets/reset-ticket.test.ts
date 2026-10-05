import { describe, expect, it } from 'vitest';
import { resetTicket } from '../../src/tickets/reset-ticket.js';

type RequestRecord = { readonly url: string; readonly method: string | undefined };

describe('resetTicket', () => {
  it("should post to the ticket's reset under the project's owner and name", async () => {
    const requests: RequestRecord[] = [];
    await resetTicket('MoritzKopmann/postkarte', 57, (url, requestInit) => {
      requests.push({ url, method: requestInit.method });
      return Promise.resolve(new Response(null, { status: 204 }));
    });
    expect(requests).toEqual([
      { url: '/api/projects/MoritzKopmann/postkarte/tickets/57/reset', method: 'POST' },
    ]);
  });

  it('should return reset when the route answers 204', async () => {
    const outcome = await resetTicket('o/n', 57, () =>
      Promise.resolve(new Response(null, { status: 204 })),
    );
    expect(outcome).toEqual({ kind: 'reset' });
  });

  it("should return failed with the server's message and the status when the route answers 409", async () => {
    const outcome = await resetTicket('o/n', 57, () =>
      Promise.resolve(
        new Response(JSON.stringify({ message: '#57 has an active run' }), { status: 409 }),
      ),
    );
    expect(outcome).toEqual({ kind: 'failed', message: '#57 has an active run', status: 409 });
  });

  it('should return failed without a status when the request throws', async () => {
    const outcome = await resetTicket('o/n', 57, () => Promise.reject(new TypeError('offline')));
    expect(outcome).toEqual({ kind: 'failed', message: "Can't reach aisf." });
  });
});
