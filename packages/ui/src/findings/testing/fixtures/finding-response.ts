import type { FindingResponse } from '@aisf/app/api-schemas/findings-schemas.js';

export function buildFindingResponse(overrides: Partial<FindingResponse> = {}): FindingResponse {
  return {
    id: 1,
    projectId: 'MoritzKopmann/postkarte',
    ticketNumber: 56,
    runId: 'run-1',
    kind: 'bug',
    location: 'packages/app/src/modules/uploads/domain/retry-policy.ts:42',
    summary: 'The retry counter is never reset after a successful upload.',
    state: 'open',
    reportedAt: '2026-09-30T09:40:00Z',
    ...overrides,
  };
}
