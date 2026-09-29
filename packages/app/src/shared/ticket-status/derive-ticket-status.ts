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
  const knownStatuses = issue.labelNames
    .filter((labelName) => labelName.startsWith(statusLabelPrefix))
    .map((labelName) => labelName.slice(statusLabelPrefix.length))
    .filter((value): value is TicketStatus => labelStatuses.some((status) => status === value));
  if (knownStatuses.length > 1) {
    return { status: 'conflict', conflictingStatuses: knownStatuses };
  }
  return { status: knownStatuses[0] ?? 'idea', conflictingStatuses: [] };
}
