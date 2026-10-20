export type TicketStatusDto =
  | 'idea'
  | 'backlog'
  | 'plan'
  | 'planned'
  | 'ready'
  | 'in-progress'
  | 'in-review'
  | 'conflict'
  | 'closed';

export type TicketTypeDto = 'bug' | 'enhancement' | 'task' | 'spike' | 'ui' | 'onboard';

export type ClosingPullRequestDto = {
  readonly number: number;
  readonly url: string;
  readonly state: string;
  readonly approved: boolean;
  readonly checks: 'passing' | 'failing' | 'pending' | 'none';
  readonly mergeable: 'mergeable' | 'conflicting' | 'unknown';
  readonly canBeRebased: boolean;
  readonly headCommit: string;
  readonly lastReviewActivityAt?: string;
};

export type TicketDto = {
  readonly number: number;
  readonly title: string;
  readonly url: string;
  readonly body: string;
  readonly status: TicketStatusDto;
  readonly conflictingStatuses: ReadonlyArray<TicketStatusDto>;
  readonly hitl: boolean;
  readonly waiting: boolean;
  readonly stuck: boolean;
  readonly types: ReadonlyArray<TicketTypeDto>;
  readonly parent?: { readonly number: number; readonly title: string } | undefined;
  readonly subIssueNumbers: ReadonlyArray<number>;
  readonly blockedBy: ReadonlyArray<{
    readonly repository: string;
    readonly number: number;
    readonly open: boolean;
  }>;
  readonly closingPullRequests: ReadonlyArray<ClosingPullRequestDto>;
  readonly updatedAt: string;
};
