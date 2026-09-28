import type { TicketStatus } from '../types/ticket-status.js';

const statusLabelPrefix = 'status: ';
const labelledStatuses: ReadonlyArray<TicketStatus> = [
  'backlog',
  'plan',
  'planned',
  'ready',
  'in-progress',
  'in-review',
  'stuck',
];

export function deriveTicketStatus(
  labelNames: ReadonlyArray<string>,
  closed: boolean,
): TicketStatus {
  if (closed) {
    return 'closed';
  }
  const statusLabels = labelNames.filter((name) => name.startsWith(statusLabelPrefix));
  if (statusLabels.length === 0) {
    return 'idea';
  }
  const [onlyLabel] = statusLabels;
  if (statusLabels.length > 1) {
    return 'conflict';
  }
  return (
    labelledStatuses.find((status) => onlyLabel === `${statusLabelPrefix}${status}`) ?? 'conflict'
  );
}
