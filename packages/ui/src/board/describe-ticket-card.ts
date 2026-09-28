import type { TicketResponse } from '@aisf/app/api-schemas/tickets-schemas.js';
import { ticketStatusLabel } from './ticket-status-labels.js';

export type TicketCardDescription = {
  readonly href: string;
  readonly numberLabel: string;
  readonly title: string;
  readonly parentTitle?: string;
  readonly hitl: boolean;
  readonly blockerLabels: ReadonlyArray<string>;
  readonly conflictLabels: ReadonlyArray<string>;
  readonly pullRequestChips: ReadonlyArray<{ readonly label: string; readonly state: string }>;
};

export function describeTicketCard(
  ticket: TicketResponse,
  projectId: string,
): TicketCardDescription {
  const blockerLabels = ticket.blockedBy
    .filter((blocker) => blocker.open)
    .map((blocker) =>
      blocker.repository.toLowerCase() === projectId.toLowerCase()
        ? `blocked by #${blocker.number}`
        : `blocked by ${blocker.repository}#${blocker.number}`,
    );
  return {
    href: `#/projects/${projectId}/tickets/${ticket.number}`,
    numberLabel: `#${ticket.number}`,
    title: ticket.title,
    ...(ticket.parent === undefined ? {} : { parentTitle: ticket.parent.title }),
    hitl: ticket.hitl,
    blockerLabels,
    conflictLabels: ticket.conflictingStatuses.map(ticketStatusLabel),
    pullRequestChips: ticket.closingPullRequests.map((pullRequest) => ({
      label: `PR #${pullRequest.number}`,
      state: pullRequest.state,
    })),
  };
}
