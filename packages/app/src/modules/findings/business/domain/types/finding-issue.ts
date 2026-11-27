import type { TicketType } from '../../../../../shared/ticket-type/ticket-type.js';

export type FindingIssue = {
  readonly title: string;
  readonly body: string;
  readonly types?: ReadonlyArray<TicketType>;
};
