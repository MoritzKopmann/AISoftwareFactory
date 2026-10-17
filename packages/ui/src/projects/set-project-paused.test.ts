import { describe, expect, it } from 'vitest';
import type { ProjectResponse } from '@aisf/app/api-schemas/projects-schemas.js';
import { setProjectPaused } from './set-project-paused.js';

const project: ProjectResponse = {
  id: 'o/n',
  repository: { owner: 'o', name: 'n' },
  checkoutPath: '/checkouts/n',
  addedAt: '2026-01-01T00:00:00Z',
  paused: true,
  contract: { passed: true, missingSlots: [], missingKeys: [] },
};

describe('setProjectPaused', () => {
  it("should patch the project's route under its owner and name with the paused flag as JSON", async () => {
    const requests: { url: string; requestInit: RequestInit }[] = [];
    await setProjectPaused('MoritzKopmann/postkarte', true, (url, requestInit) => {
      requests.push({ url, requestInit });
      return Promise.resolve(Response.json(project));
    });
    expect(requests).toEqual([
      {
        url: '/api/projects/MoritzKopmann/postkarte',
        requestInit: {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: '{"paused":true}',
        },
      },
    ]);
  });

  it('should return saved with the returned project when the route answers 200', async () => {
    const outcome = await setProjectPaused('o/n', true, () =>
      Promise.resolve(Response.json(project)),
    );
    expect(outcome).toEqual({ kind: 'saved', project });
  });

  it("should return failed with the server's message and the status when the route answers 404", async () => {
    const outcome = await setProjectPaused('o/n', true, () =>
      Promise.resolve(
        Response.json({ message: 'Project o/n is not registered.' }, { status: 404 }),
      ),
    );
    expect(outcome).toEqual({
      kind: 'failed',
      message: 'Project o/n is not registered.',
      status: 404,
    });
  });

  it('should return failed without a status when the request throws', async () => {
    const outcome = await setProjectPaused('o/n', true, () =>
      Promise.reject(new TypeError('offline')),
    );
    expect(outcome).toEqual({ kind: 'failed', message: "Can't reach aisf." });
  });

  it('should propagate the error when the request throws an error that is not a network failure', async () => {
    await expect(
      setProjectPaused('o/n', true, () => Promise.reject(new RangeError('bug'))),
    ).rejects.toThrow(RangeError);
  });
});
