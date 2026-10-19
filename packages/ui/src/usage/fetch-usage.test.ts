import { describe, expect, it } from 'vitest';
import { fetchUsage } from './fetch-usage.js';

const usage = {
  pausedUntil: null,
  observedAt: '2026-10-19T09:00:00.000Z',
  fiveHour: { utilizationPercent: 62, resetsAt: '2026-10-19T14:00:00.000Z' },
  sevenDay: null,
};

describe('fetchUsage', () => {
  it('should ask for the usage and return the answer when the route answers 200', async () => {
    const requestedUrls: string[] = [];
    const outcome = await fetchUsage((url) => {
      requestedUrls.push(url);
      return Promise.resolve(new Response(JSON.stringify(usage), { status: 200 }));
    });
    expect(requestedUrls).toEqual(['/api/usage']);
    expect(outcome).toEqual({ kind: 'answer', usage });
  });

  it('should return request-failed when the route answers an error', async () => {
    expect(await fetchUsage(() => Promise.resolve(new Response('{}', { status: 500 })))).toEqual({
      kind: 'request-failed',
    });
  });

  it('should return request-failed when the request throws', async () => {
    expect(await fetchUsage(() => Promise.reject(new TypeError('down')))).toEqual({
      kind: 'request-failed',
    });
  });
});
