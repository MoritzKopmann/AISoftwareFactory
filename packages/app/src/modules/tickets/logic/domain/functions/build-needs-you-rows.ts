import type { NeedsYouAction, NeedsYouRow, NeedsYouWait } from '../types/needs-you-row.js';
import type { Ticket } from '../types/ticket.js';

const actionByWaitKind: Readonly<Record<NeedsYouWait['kind'], NeedsYouAction>> = {
  round: 'answer-round',
  question: 'answer-question',
  permission: 'allow-permission',
};

function buildRow(ticket: Ticket, waits: ReadonlyArray<NeedsYouWait>): NeedsYouRow | undefined {
  const row = (action: NeedsYouAction, since: string): NeedsYouRow => ({
    ticketNumber: ticket.number,
    title: ticket.title,
    action,
    since,
  });
  if (ticket.stuck) {
    return row('decide-stuck', ticket.updatedAt);
  }
  const wait = ticket.waiting
    ? waits.find((candidate) => candidate.ticketNumber === ticket.number)
    : undefined;
  if (wait !== undefined) {
    return row(actionByWaitKind[wait.kind], wait.since);
  }
  return ticket.status === 'in-review' ? row('review-pull-request', ticket.updatedAt) : undefined;
}

export function buildNeedsYouRows(
  tickets: ReadonlyArray<Ticket>,
  waits: ReadonlyArray<NeedsYouWait>,
): ReadonlyArray<NeedsYouRow> {
  return tickets
    .flatMap((ticket) => buildRow(ticket, waits) ?? [])
    .sort(
      (left, right) =>
        Date.parse(left.since) - Date.parse(right.since) || left.ticketNumber - right.ticketNumber,
    );
}
