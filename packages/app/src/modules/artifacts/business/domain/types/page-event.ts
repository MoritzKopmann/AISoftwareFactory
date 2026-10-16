export type PageEvent = {
  readonly kind: 'submit' | 'confirm' | 'reopen';
  readonly round: number;
  readonly payload: unknown;
};
