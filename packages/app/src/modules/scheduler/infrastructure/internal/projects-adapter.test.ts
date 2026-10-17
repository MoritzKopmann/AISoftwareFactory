import { describe, expect, it } from 'vitest';
import { fakeProjectsApi } from '../../testing/fake-scheduler-apis.js';
import { ProjectsAdapter } from './projects-adapter.js';

describe('ProjectsAdapter', () => {
  describe('find', () => {
    it('should report paused when the project is paused', async () => {
      const adapter = new ProjectsAdapter(fakeProjectsApi(true));

      expect(await adapter.find('moritz/aisf')).toMatchObject({ paused: true });
    });

    it('should report not paused when the project is running', async () => {
      const adapter = new ProjectsAdapter(fakeProjectsApi());

      expect(await adapter.find('moritz/aisf')).toMatchObject({ paused: false });
    });
  });
});
