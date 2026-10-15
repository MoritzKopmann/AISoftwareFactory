import { describe, expect, it } from 'vitest';
import { FakeProjectsApi, repository } from '../../testing/fake-findings-ports.js';
import { ProjectsProjectLookup } from './projects-project-lookup.js';

describe('ProjectsProjectLookup', () => {
  it('should answer the repository when the project is listed', async () => {
    const lookup = new ProjectsProjectLookup(new FakeProjectsApi());

    expect(await lookup.find('moritz/aisf')).toEqual({ repository });
  });

  it('should answer undefined when the project is not listed', async () => {
    const lookup = new ProjectsProjectLookup(new FakeProjectsApi());

    expect(await lookup.find('moritz/other')).toBeUndefined();
  });
});
