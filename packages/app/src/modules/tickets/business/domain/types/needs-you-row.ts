export type NeedsYouAction =
  'answer-round' | 'answer-question' | 'allow-permission' | 'decide-stuck' | 'review-pull-request';

export type NeedsYouRow = {
  readonly ticketNumber: number;
  readonly title: string;
  readonly action: NeedsYouAction;
  readonly since: string;
};

export type NeedsYouWait = {
  readonly ticketNumber: number;
  readonly kind: 'round' | 'question' | 'permission';
  readonly since: string;
};
