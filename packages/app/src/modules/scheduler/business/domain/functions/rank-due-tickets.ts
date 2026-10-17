import type { ReviewedTicket } from '../types/reviewed-ticket.js';

const rankByStatus: Readonly<Partial<Record<ReviewedTicket['status'], number>>> = {
  ready: 0,
  plan: 1,
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
