import type { Artifact } from '../../../../src/modules/artifacts/logic/domain/types/artifact.js';

export function buildArtifact(overrides: Partial<Artifact> = {}): Artifact {
  return {
    token: 'T',
    projectId: 'o/n',
    ticketNumber: 7,
    artifactId: 'plan',
    title: 'Plan review',
    directory: '/worktrees/n/7/.aisf/artifacts/plan',
    runId: 'r1',
    version: 1,
    publishedAt: '2026-10-06T10:00:00.000Z',
    ...overrides,
  };
}
