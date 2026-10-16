export type ActiveWait = {
  readonly ticketNumber: number;
  readonly kind: 'round' | 'question' | 'permission';
  readonly since: string;
};
