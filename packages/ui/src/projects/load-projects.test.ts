import { describe, expect, it } from 'vitest';
import { loadProjects } from './load-projects.js';

describe('loadProjects', () => {
  it('should get the project list and return it when the route answers 200', async () => {
    const urls: string[] = [];
    const outcome = await loadProjects((url) => {
      urls.push(url);
      return Promise.resolve(Response.json([]));
    });
    expect(urls).toEqual(['/api/projects']);
    expect(outcome).toEqual({ kind: 'loaded', projects: [] });
  });

  it('should return failed with the status as detail when the route answers 500', async () => {
    const outcome = await loadProjects(() => Promise.resolve(new Response(null, { status: 500 })));
    expect(outcome).toEqual({ kind: 'failed', detail: 'HTTP 500' });
  });

  it('should return failed with the network message as detail when the request throws', async () => {
    const outcome = await loadProjects(() => Promise.reject(new TypeError('offline')));
    expect(outcome).toEqual({ kind: 'failed', detail: "Can't reach aisf." });
  });

  it('should propagate the error when the request throws an error that is not a network failure', async () => {
    await expect(loadProjects(() => Promise.reject(new RangeError('bug')))).rejects.toThrow(
      RangeError,
    );
  });
});
