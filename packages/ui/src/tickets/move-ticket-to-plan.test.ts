import { describe, expect, it } from 'vitest';
import { moveTicketToPlan } from './move-ticket-to-plan.js';

type RequestRecord = { readonly url: string; readonly method: string | undefined };

describe('moveTicketToPlan', () => {
  it("should post to the ticket's move-to-plan under the project's owner and name", async () => {
    const requests: RequestRecord[] = [];
    await moveTicketToPlan('MoritzKopmann/postkarte', 57, (url, requestInit) => {
      requests.push({ url, method: requestInit.method });
      return Promise.resolve(new Response(null, { status: 204 }));
    });
    expect(requests).toEqual([
      { url: '/api/projects/MoritzKopmann/postkarte/tickets/57/move-to-plan', method: 'POST' },
    ]);
  });

  it('should return moved when the route answers 204', async () => {
    const outcome = await moveTicketToPlan('o/n', 57, () =>
      Promise.resolve(new Response(null, { status: 204 })),
    );
    expect(outcome).toEqual({ kind: 'moved' });
  });

  it("should return failed with the server's message and the status when the route answers 409", async () => {
    const outcome = await moveTicketToPlan('o/n', 57, () =>
      Promise.resolve(
        new Response(JSON.stringify({ message: 'Ticket #57 is no longer in backlog.' }), {
          status: 409,
        }),
      ),
    );
    expect(outcome).toEqual({
      kind: 'failed',
      message: 'Ticket #57 is no longer in backlog.',
      status: 409,
    });
  });

  it('should return failed with an empty message when the route answers 400 without a body', async () => {
    const outcome = await moveTicketToPlan('o/n', 57, () =>
      Promise.resolve(new Response(null, { status: 400 })),
    );
    expect(outcome).toEqual({ kind: 'failed', message: '', status: 400 });
  });

  it('should return failed without a status when the request throws', async () => {
    const outcome = await moveTicketToPlan('o/n', 57, () =>
      Promise.reject(new TypeError('offline')),
    );
    expect(outcome).toEqual({ kind: 'failed', message: "Can't reach aisf." });
  });

  it('should propagate the error when the request throws an error that is not a network failure', async () => {
    await expect(
      moveTicketToPlan('o/n', 57, () => Promise.reject(new RangeError('bug'))),
    ).rejects.toThrow(RangeError);
  });
});
