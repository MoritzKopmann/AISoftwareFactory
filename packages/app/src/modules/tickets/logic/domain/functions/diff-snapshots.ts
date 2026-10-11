import type { SnapshotDiff } from '../types/snapshot-diff.js';
import type { Ticket } from '../types/ticket.js';
import type { TicketSnapshot } from '../types/ticket-snapshot.js';

export function diffSnapshots(
  previous: TicketSnapshot | undefined,
  current: TicketSnapshot,
): SnapshotDiff {
  const previousTickets = ticketsByNumber(previous);
  const currentTickets = ticketsByNumber(current);
  const addedTicketNumbers: number[] = [];
  const changedTicketNumbers: number[] = [];
  for (const [number, ticket] of currentTickets) {
    const previousTicket = previousTickets.get(number);
    if (previousTicket === undefined) {
      addedTicketNumbers.push(number);
    } else if (!hasSameValue(previousTicket, ticket)) {
      changedTicketNumbers.push(number);
    }
  }
  const removedTicketNumbers = [...previousTickets.keys()].filter(
    (number) => !currentTickets.has(number),
  );
  return { addedTicketNumbers, changedTicketNumbers, removedTicketNumbers };
}

function ticketsByNumber(snapshot: TicketSnapshot | undefined): ReadonlyMap<number, Ticket> {
  const tickets = [...(snapshot?.openTickets ?? []), ...(snapshot?.recentlyClosedTickets ?? [])];
  return new Map(tickets.map((ticket) => [ticket.number, ticket]));
}

function hasSameValue(left: unknown, right: unknown): boolean {
  if (Array.isArray(left) && Array.isArray(right)) {
    return (
      left.length === right.length && left.every((item, index) => hasSameValue(item, right[index]))
    );
  }
  if (isRecord(left) && isRecord(right)) {
    const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
    return [...keys].every((key) => hasSameValue(left[key], right[key]));
  }
  return left === right;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
