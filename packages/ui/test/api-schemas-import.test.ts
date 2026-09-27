import { describe, expect, it } from 'vitest';
import type { ProjectResponse } from '@aisf/app/api-schemas/projects-schemas.js';

describe('@aisf/app/api-schemas', () => {
  it('should resolve a project response type from the app package', () => {
    const project: ProjectResponse = {
      id: 'owner/name',
      repository: { owner: 'owner', name: 'name' },
      checkoutPath: '/repo',
      addedAt: '2026-01-01T00:00:00.000Z',
    };

    expect(project.id).toBe('owner/name');
  });
});
