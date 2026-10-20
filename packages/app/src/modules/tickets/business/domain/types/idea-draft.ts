import type { TicketStatus } from '../../../../../shared/ticket-status/ticket-status.js';
import type { TicketType } from '../../../../../shared/ticket-type/ticket-type.js';
import type { TicketPriority } from './ticket-priority.js';

export type IdeaDraft = {
  readonly title: string;
  readonly body: string;
  readonly status?: TicketStatus;
  readonly types?: ReadonlyArray<TicketType>;
  readonly priority?: TicketPriority;
};
