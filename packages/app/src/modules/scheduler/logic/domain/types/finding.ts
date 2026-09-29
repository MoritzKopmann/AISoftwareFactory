export type FindingKind = 'bug' | 'gap';

export type FindingState = 'open' | 'creating' | 'ticketed' | 'dismissed';

export type Finding = {
  readonly id: number;
  readonly projectId: string;
  readonly ticketNumber: number;
  readonly runId: string;
  readonly kind: FindingKind;
  readonly location: string;
  readonly summary: string;
  readonly state: FindingState;
  readonly createdTicketNumber?: number;
  readonly reportedAt: string;
  readonly resolvedAt?: string;
};
