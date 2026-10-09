import type { AisfEventMap } from '../bus/aisf-event-map.js';
import type { LiveNotice } from './schemas/live-notice-schemas.js';

/** Keeps only the event name, the project id and the ticket number. Everything else stays on the server. */
export function toLiveNotice<Name extends keyof AisfEventMap>(
  eventName: Name,
  payload: AisfEventMap[Name],
): LiveNotice {
  const ids: { projectId?: unknown; ticketNumber?: unknown } = payload;
  return {
    event: eventName,
    ...(typeof ids.projectId === 'string' ? { projectId: ids.projectId } : {}),
    ...(typeof ids.ticketNumber === 'number' ? { ticketNumber: ids.ticketNumber } : {}),
  };
}
