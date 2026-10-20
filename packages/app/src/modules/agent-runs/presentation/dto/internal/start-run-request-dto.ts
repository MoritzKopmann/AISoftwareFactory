export type StartRunRequestDto = {
  readonly projectId: string;
  readonly ticketNumber: number;
  readonly mode: 'afk';
  readonly ticketTitle: string;
  readonly status:
    | 'idea'
    | 'backlog'
    | 'plan'
    | 'planned'
    | 'ready'
    | 'in-progress'
    | 'in-review'
    | 'conflict'
    | 'closed';
  readonly types: ReadonlyArray<'bug' | 'enhancement' | 'task' | 'spike' | 'ui' | 'onboard'>;
};
