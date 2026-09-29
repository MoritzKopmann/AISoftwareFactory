import type { Finding } from '../../../../src/modules/scheduler/logic/domain/types/finding.js';

export function buildFinding(overrides: Partial<Finding> = {}): Finding {
  return {
    id: 1,
    projectId: 'moritz/aisf',
    ticketNumber: 141,
    runId: 'run-1',
    kind: 'bug',
    location: 'src/a.ts:12',
    summary: 'Retry loop never stops',
    state: 'open',
    reportedAt: '2026-09-29T10:00:00.000Z',
    ...overrides,
  };
}
