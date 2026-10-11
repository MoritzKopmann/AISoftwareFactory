import { ticketStatusOrder } from './ticket-status-order.js';
import type { DerivedTicketStatus } from './derived-ticket-status.js';
import type { TicketStatus } from './ticket-status.js';

const statusLabelPrefix = 'status: ';

const statusesWithoutLabel: ReadonlyArray<TicketStatus> = ['idea', 'conflict', 'closed'];

const labelStatuses = ticketStatusOrder.filter((status) => !statusesWithoutLabel.includes(status));

export function deriveTicketStatus(issue: {
  readonly state: 'open' | 'closed';
  readonly labelNames: ReadonlyArray<string>;
}): DerivedTicketStatus {
  if (issue.state === 'closed') {
    return { status: 'closed', conflictingStatuses: [] };
  }
  const statusLabelValues = issue.labelNames
    .filter((labelName) => labelName.startsWith(statusLabelPrefix))
    .map((labelName) => labelName.slice(statusLabelPrefix.length));
  const knownStatuses = statusLabelValues.filter((value): value is TicketStatus =>
    labelStatuses.some((status) => status === value),
  );
  // A status label that names no lifecycle status (e.g. the legacy `status: stuck`) conflicts.
  if (statusLabelValues.length > 1 || knownStatuses.length < statusLabelValues.length) {
    return { status: 'conflict', conflictingStatuses: knownStatuses };
  }
  return { status: knownStatuses[0] ?? 'idea', conflictingStatuses: [] };
}
