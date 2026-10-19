import type { ReviewedTicket } from '../types/reviewed-ticket.js';

const rankByStatus: Readonly<Partial<Record<ReviewedTicket['status'], number>>> = {
  'in-review': 0,
  ready: 1,
  plan: 2,
};

export function rankDueTickets(
  tickets: ReadonlyArray<ReviewedTicket>,
): ReadonlyArray<ReviewedTicket> {
  return tickets
    .filter(({ status }) => rankByStatus[status] !== undefined)
    .toSorted(
      (first, second) => (rankByStatus[first.status] ?? 0) - (rankByStatus[second.status] ?? 0),
    );
}
