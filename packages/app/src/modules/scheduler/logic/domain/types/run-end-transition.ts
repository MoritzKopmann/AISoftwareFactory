import type { TicketStatus } from '../../../../../shared/ticket-status/ticket-status.js';

export type RunEndTransition =
  | { readonly kind: 'none' }
  | {
      readonly kind: 'transition';
      readonly to: TicketStatus;
      readonly comment?: string;
    };
