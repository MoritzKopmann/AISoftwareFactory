import type { ReviewedTicket } from '../types/reviewed-ticket.js';

const rankByStatus: Readonly<Partial<Record<ReviewedTicket['status'], number>>> = {
  'in-review': 0,
  ready: 1,
  plan: 2,
};
const autoIdeaRank = 3;

export function rankDueTickets(
  tickets: ReadonlyArray<ReviewedTicket>,
): ReadonlyArray<ReviewedTicket> {
  return tickets
    .filter((ticket) => rankOf(ticket) !== undefined)
    .toSorted((first, second) => (rankOf(first) ?? 0) - (rankOf(second) ?? 0));
}

function rankOf({ status, types }: ReviewedTicket): number | undefined {
  if (status === 'idea') {
    return startsWithoutRunPress(types) ? autoIdeaRank : undefined;
  }
  return rankByStatus[status];
}

function startsWithoutRunPress(types: ReviewedTicket['types']): boolean {
  return types.includes('ui') || types.includes('bug');
}
