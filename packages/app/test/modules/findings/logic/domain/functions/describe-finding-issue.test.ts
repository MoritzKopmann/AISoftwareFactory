import { describe, expect, it } from 'vitest';
import { describeFindingIssue } from '../../../../../../src/modules/findings/logic/domain/functions/describe-finding-issue.js';
import { buildFinding } from '../../../fakes/build-finding.js';

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
