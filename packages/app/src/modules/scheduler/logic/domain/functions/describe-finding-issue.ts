import type { Finding } from '../types/finding.js';

export type FindingIssue = {
  readonly title: string;
  readonly body: string;
};

export function describeFindingIssue(finding: Finding): FindingIssue {
  return {
    title: finding.summary,
    body: [
      `Kind: ${finding.kind}`,
      `Location: \`${finding.location}\``,
      '',
      `Found while implementing #${finding.ticketNumber}`,
    ].join('\n'),
  };
}
