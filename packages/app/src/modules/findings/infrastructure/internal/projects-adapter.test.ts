import { describe, expect, it } from 'vitest';
import { FakeProjectsApi, repository } from '../../testing/fake-findings-ports.js';
import { ProjectsAdapter } from './projects-adapter.js';

describe('ProjectsAdapter', () => {
  it('should answer the repository when the project is listed', async () => {
    const adapter = new ProjectsAdapter(new FakeProjectsApi());

    expect(await adapter.find('moritz/aisf')).toEqual({ repository });
  });

  it('should answer undefined when the project is not listed', async () => {
    const adapter = new ProjectsAdapter(new FakeProjectsApi());

    expect(await adapter.find('moritz/other')).toBeUndefined();
  });
});
