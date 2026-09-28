import type { TicketStatus } from './ticket-status.js';

export type RunEndTransition =
  | { readonly kind: 'none' }
  | {
      readonly kind: 'transition';
      readonly allowedFrom: ReadonlyArray<TicketStatus>;
      readonly to: TicketStatus;
      readonly comment?: string;
    };
