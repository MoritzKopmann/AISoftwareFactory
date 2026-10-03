import type { TicketStatus } from '../ticket-status/ticket-status.js';

export type AisfEventMap = {
  readonly 'project.added': {
    readonly projectId: string;
    readonly repository: { readonly owner: string; readonly name: string };
    readonly checkoutPath: string;
  };
  readonly 'snapshot.changed': {
    readonly projectId: string;
    readonly addedTicketNumbers: ReadonlyArray<number>;
    readonly changedTicketNumbers: ReadonlyArray<number>;
    readonly removedTicketNumbers: ReadonlyArray<number>;
  };
  readonly 'run.finished': {
    readonly runId: string;
    readonly projectId: string;
    readonly ticketNumber: number;
    readonly ending:
      | {
          readonly kind: 'escalated';
          readonly escalation: 'red' | 'spec' | 'denied';
          readonly reason: string;
        }
      | {
          readonly kind: 'permission-needed';
          readonly toolName: string;
          readonly toolInput: Readonly<Record<string, unknown>>;
        }
      | { readonly kind: 'parked'; readonly blockerNumber: number }
      | { readonly kind: 'finished' }
      | { readonly kind: 'stopped' }
      | { readonly kind: 'crashed'; readonly reason: string }
      | { readonly kind: 'usage-limit'; readonly reason: string }
      | { readonly kind: 'app-restarted' }
      | { readonly kind: 'checkpoint'; readonly request: string };
  };
  readonly 'ticket.status-written': {
    readonly projectId: string;
    readonly ticketNumber: number;
    readonly from: TicketStatus;
    readonly to: TicketStatus;
  };
};
