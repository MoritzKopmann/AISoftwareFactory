import type { RunAvailability } from '../types/run-availability.js';
import type { OpenPullRequest, SchedulableTicket } from '../types/schedulable-ticket.js';
import type { RunAvailabilityInput } from '../types/run-availability-input.js';

export function determineRunAvailability(input: RunAvailabilityInput): RunAvailability {
  const {
    ticket,
    subIssues,
    ticketIsRunning,
    runsBlocked,
    projectOnboarded,
    lastRunEndedAt,
    trigger,
    projectPaused,
  } = input;
  if (ticket === undefined || ticket.hasOpenBlocker || !isRunnableTicket(ticket, lastRunEndedAt)) {
    return { kind: 'absent' };
  }
  if (trigger === 'auto') {
    if (ticket.status === 'idea') {
      return { kind: 'absent' };
    }
    const autoBlock = findAutoBlock(ticket, projectPaused);
    if (autoBlock !== undefined) {
      return { kind: 'disabled', reason: autoBlock };
    }
  }
  if (ticketIsRunning) {
    return { kind: 'disabled', reason: `#${ticket.number} is running` };
  }
  const openSpike = subIssues.find(
    ({ status, types }) => status !== 'closed' && types.includes('spike'),
  );
  if (ticket.status === 'plan' && openSpike !== undefined) {
    return { kind: 'disabled', reason: `Waiting for spike #${openSpike.number}` };
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

function findAutoBlock(ticket: SchedulableTicket, projectPaused: boolean): string | undefined {
  if (projectPaused) {
    return 'The project is paused';
  }
  if (ticket.syncFailed) {
    return 'The last sync failed';
  }
  if (ticket.stuck) {
    return `#${ticket.number} is stuck`;
  }
  if (ticket.waiting) {
    return `#${ticket.number} is waiting for a human`;
  }
  return undefined;
}

function isRunnableTicket(ticket: SchedulableTicket, lastRunEndedAt: string | undefined): boolean {
  if (ticket.status === 'idea' || ticket.status === 'plan') {
    return true;
  }
  if (!ticket.isLeaf || isPureUiTicket(ticket)) {
    return false;
  }
  if (ticket.status === 'in-review') {
    return needsRework(ticket.openPullRequest, lastRunEndedAt);
  }
  return ticket.status === 'ready';
}

function isPureUiTicket(ticket: SchedulableTicket): boolean {
  return ticket.types.includes('ui') && !ticket.types.includes('spike');
}

function needsRework(
  pullRequest: OpenPullRequest | undefined,
  lastRunEndedAt: string | undefined,
): boolean {
  if (pullRequest === undefined) {
    return false;
  }
  return (
    pullRequest.mergeable === 'conflicting' || hasUnansweredReview(pullRequest, lastRunEndedAt)
  );
}

function hasUnansweredReview(
  pullRequest: OpenPullRequest,
  lastRunEndedAt: string | undefined,
): boolean {
  const { approved, lastReviewActivityAt } = pullRequest;
  if (approved || lastReviewActivityAt === undefined) {
    return false;
  }
  return (
    lastRunEndedAt === undefined || Date.parse(lastReviewActivityAt) > Date.parse(lastRunEndedAt)
  );
}
