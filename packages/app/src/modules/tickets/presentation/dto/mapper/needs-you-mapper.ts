import type { NeedsYouRow } from '../../../business/domain/types/needs-you-row.js';
import type { NeedsYouRowResponse } from '../api/needs-you-schemas.js';

export function toNeedsYouRowResponse(row: NeedsYouRow): NeedsYouRowResponse {
  return { ticketNumber: row.ticketNumber, title: row.title, action: row.action, since: row.since };
}
