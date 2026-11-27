import type { Finding } from '../types/finding.js';
import type { FindingIssue } from '../types/finding-issue.js';

export function describeFindingIssue(finding: Finding): FindingIssue {
  const issue = {
    title: finding.summary,
    body: [
      `Kind: ${finding.kind}`,
      `Location: \`${finding.location}\``,
      '',
      `Found while implementing #${finding.ticketNumber}`,
    ].join('\n'),
  };

  return finding.kind === 'bug' ? { ...issue, types: ['bug'] } : issue;
}
