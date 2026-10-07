export type TicketLatestRun = {
  readonly id: string;
  readonly state: 'running' | 'ended' | 'settled';
  readonly waitingFor?: { readonly kind?: string; readonly artifactId?: string };
  readonly ending?: { readonly kind: string; readonly artifactId?: string };
};
