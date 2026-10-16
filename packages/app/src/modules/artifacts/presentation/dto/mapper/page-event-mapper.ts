import type { PageEvent } from '../../../business/domain/types/page-event.js';
import type { PageEventBody } from '../api/page-events-schemas.js';

export function toPageEvent({ kind, round, payload }: PageEventBody): PageEvent {
  return { kind, round, payload };
}
