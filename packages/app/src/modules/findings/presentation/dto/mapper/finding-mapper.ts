import type { Finding } from '../../../business/domain/types/finding.js';
import type { FindingResponse } from '../api/findings-schemas.js';

export function toFindingResponse(finding: Finding): FindingResponse {
  return {
    id: finding.id,
    projectId: finding.projectId,
    ticketNumber: finding.ticketNumber,
    runId: finding.runId,
    kind: finding.kind,
    location: finding.location,
    summary: finding.summary,
    state: finding.state,
    ...(finding.createdTicketNumber === undefined
      ? {}
      : { createdTicketNumber: finding.createdTicketNumber }),
    reportedAt: finding.reportedAt,
    ...(finding.resolvedAt === undefined ? {} : { resolvedAt: finding.resolvedAt }),
  };
}
