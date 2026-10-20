import type { TicketStatus } from '../../../../../shared/ticket-status/ticket-status.js';
import type { TicketType } from '../../../../../shared/ticket-type/ticket-type.js';

export type IdeaDraft = {
  readonly title: string;
  readonly body: string;
  readonly status?: TicketStatus;
  readonly types?: ReadonlyArray<TicketType>;
  readonly priority?: 'critical' | 'high' | 'medium' | 'low';
};
