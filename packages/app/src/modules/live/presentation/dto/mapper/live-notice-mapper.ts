import type { DomainEvents } from '../../../../../shared/event-bus.js';
import type { LiveNotice } from '../api/live-notice-schemas.js';

/** Keeps only the event name, the project id and the ticket number, plus `changed` and `polledAt` for `watch.updated`. Everything else stays on the server. */
export function toLiveNotice<Name extends keyof DomainEvents>(
  eventName: Name,
  payload: DomainEvents[Name],
): LiveNotice {
  const ids: Readonly<Record<string, unknown>> = payload;
  const poll: Readonly<Record<string, unknown>> = payload;
  return {
    event: eventName,
    ...(typeof ids.projectId === 'string' ? { projectId: ids.projectId } : {}),
    ...(typeof ids.ticketNumber === 'number' ? { ticketNumber: ids.ticketNumber } : {}),
    ...(eventName === 'watch.updated' && typeof poll.changed === 'boolean'
      ? { changed: poll.changed }
      : {}),
    ...(eventName === 'watch.updated' && typeof poll.polledAt === 'string'
      ? { polledAt: poll.polledAt }
      : {}),
  };
}
