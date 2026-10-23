import type { TicketResponse } from '@aisf/app/api-schemas/tickets-schemas.js';
import { describeLabelMarker, type LabelMarker } from './describe-label-marker.js';
import { ticketStatusLabel } from './ticket-status-labels.js';

export type RunMarker = 'running' | LabelMarker;

export type TicketCardDescription = {
  readonly href: string;
  readonly number: number;
  readonly numberLabel: string;
  readonly title: string;
  readonly backlog: boolean;
  readonly parentTitle?: string;
  readonly hitl: boolean;
  readonly spike: boolean;
  readonly ui: boolean;
  readonly blockerLabels: ReadonlyArray<string>;
  readonly conflictLabels: ReadonlyArray<string>;
  readonly pullRequestChips: ReadonlyArray<{ readonly label: string }>;
  readonly runMarker?: RunMarker;
};

function describeRunMarker(
  ticket: TicketResponse,
  runningTicketNumbers: ReadonlyArray<number>,
): RunMarker | undefined {
  const labelMarker = describeLabelMarker(ticket);
  if (labelMarker !== undefined) {
    return labelMarker;
  }
  if (runningTicketNumbers.includes(ticket.number)) {
    return 'running';
  }
  return undefined;
}

export function describeTicketCard(
  ticket: TicketResponse,
  projectId: string,
  runningTicketNumbers: ReadonlyArray<number>,
): TicketCardDescription {
  const blockerLabels = ticket.blockedBy
    .filter((blocker) => blocker.open)
    .map((blocker) =>
      blocker.repository.toLowerCase() === projectId.toLowerCase()
        ? `blocked by #${blocker.number}`
        : `blocked by ${blocker.repository}#${blocker.number}`,
    );
  const runMarker = describeRunMarker(ticket, runningTicketNumbers);
  return {
    href: `#/projects/${projectId}/tickets/${ticket.number}`,
    number: ticket.number,
    numberLabel: `#${ticket.number}`,
    title: ticket.title,
    backlog: ticket.status === 'backlog',
    ...(ticket.parent === undefined ? {} : { parentTitle: ticket.parent.title }),
    hitl: ticket.hitl,
    spike: ticket.types.includes('spike'),
    ui: ticket.types.includes('ui'),
    blockerLabels,
    conflictLabels: ticket.conflictingStatuses.map((status) =>
      ticketStatusLabel(status).toLowerCase(),
    ),
    pullRequestChips: ticket.closingPullRequests.map((pullRequest) => ({
      label: `PR #${pullRequest.number}`,
    })),
    ...(runMarker === undefined ? {} : { runMarker }),
  };
}
