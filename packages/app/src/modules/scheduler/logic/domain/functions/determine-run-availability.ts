import type { RunAvailability } from '../types/run-availability.js';
import type { SchedulableTicket } from '../types/schedulable-ticket.js';
import type { RunAvailabilityInput } from '../types/run-availability-input.js';

export function determineRunAvailability(input: RunAvailabilityInput): RunAvailability {
  const { ticket, ticketIsRunning, runsBlocked, projectOnboarded, lastRunEndedAt } = input;
  if (ticket === undefined || ticket.hasOpenBlocker || !isRunnableTicket(ticket)) {
    return { kind: 'absent' };
  }
  if (ticketIsRunning) {
    return { kind: 'disabled', reason: `#${ticket.number} is running` };
  }
  const [openSpikeNumber] = ticket.openSpikeNumbers;
  if (ticket.status === 'plan' && openSpikeNumber !== undefined) {
    return { kind: 'disabled', reason: `Waiting for spike #${openSpikeNumber}` };
  }
  if (runsBlocked.blocked) {
    return { kind: 'disabled', reason: runsBlocked.reason };
  }
  if (!projectOnboarded) {
    return { kind: 'disabled', reason: 'The project is not onboarded' };
  }
  if (
    lastRunEndedAt !== undefined &&
    (ticket.snapshotTakenAt === undefined || ticket.snapshotTakenAt < lastRunEndedAt)
  ) {
    return { kind: 'disabled', reason: 'Waiting for GitHub to catch up' };
  }
  return { kind: 'available' };
}

function isRunnableTicket(ticket: SchedulableTicket): boolean {
  if (ticket.status === 'idea' || ticket.status === 'plan') {
    return true;
  }
  return (
    ticket.status === 'ready' &&
    ticket.isLeaf &&
    !(ticket.types.includes('ui') && !ticket.types.includes('spike'))
  );
}
