import { describe, expect, it } from 'vitest';
import { fetchSkillsStatus } from '../../src/skills/fetch-skills-status.js';

describe('fetchSkillsStatus', () => {
  it('should ask for the skills status and return the answer when the route answers 200', async () => {
    const requestedUrls: string[] = [];
    const outcome = await fetchSkillsStatus((url) => {
      requestedUrls.push(url);
      return Promise.resolve(new Response(JSON.stringify({ state: 'pending' }), { status: 200 }));
    });
    expect(requestedUrls).toEqual(['/api/skills/status']);
    expect(outcome).toEqual({ kind: 'answer', status: { state: 'pending' } });
  });

  it('should return request-failed when the route answers an error', async () => {
    expect(
      await fetchSkillsStatus(() => Promise.resolve(new Response('{}', { status: 500 }))),
    ).toEqual({ kind: 'request-failed' });
  });

  it('should return request-failed when the request throws', async () => {
    expect(await fetchSkillsStatus(() => Promise.reject(new Error('down')))).toEqual({
      kind: 'request-failed',
    });
  });
});
