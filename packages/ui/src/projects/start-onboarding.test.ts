import { describe, expect, it } from 'vitest';
import { startOnboarding } from './start-onboarding.js';

const answer = (status: number, body: unknown) => () =>
  Promise.resolve(new Response(JSON.stringify(body), { status }));

describe('startOnboarding', () => {
  it('should post to the onboarding route when called', async () => {
    const seen: { url: string; method: string | undefined }[] = [];
    await startOnboarding('o/n', (url, requestInit) => {
      seen.push({ url, method: requestInit.method });
      return answer(201, { ticketNumber: 7 })();
    });

    expect(seen).toEqual([{ url: '/api/projects/o/n/onboarding', method: 'POST' }]);
  });

  it('should return started with the ticket number when the route answers 201', async () => {
    expect(await startOnboarding('o/n', answer(201, { ticketNumber: 7 }))).toEqual({
      kind: 'started',
      ticketNumber: 7,
    });
  });

  it('should return conflict when the route answers 409', async () => {
    expect(await startOnboarding('o/n', answer(409, { message: 'Busy' }))).toEqual({
      kind: 'conflict',
    });
  });

  it('should return failed when the route answers 404', async () => {
    expect(await startOnboarding('o/n', answer(404, { message: 'Unknown' }))).toEqual({
      kind: 'failed',
      message: 'Unknown',
    });
  });

  it('should return failed when the request throws', async () => {
    const outcome = await startOnboarding('o/n', () => Promise.reject(new TypeError('off')));

    expect(outcome).toEqual({ kind: 'failed', message: "Can't reach aisf." });
  });
});
