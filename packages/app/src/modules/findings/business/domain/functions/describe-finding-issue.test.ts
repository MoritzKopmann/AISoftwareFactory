import { describe, expect, it } from 'vitest';
import { describeFindingIssue } from './describe-finding-issue.js';
import type { Finding } from '../types/finding.js';

function buildFinding(overrides: Partial<Finding> = {}): Finding {
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

describe('describeFindingIssue', () => {
  it('should use the summary as the title when describing a finding', () => {
    const issue = describeFindingIssue(buildFinding({ summary: 'Retry loop never stops' }));

    expect(issue.title).toBe('Retry loop never stops');
  });

  it('should list the kind, the location and the source ticket in the body when describing a finding', () => {
    const issue = describeFindingIssue(
      buildFinding({ kind: 'gap', location: 'src/a.ts:12', ticketNumber: 141 }),
    );

    expect(issue.body).toBe('Kind: gap\nLocation: `src/a.ts:12`\n\nFound while implementing #141');
  });
});
