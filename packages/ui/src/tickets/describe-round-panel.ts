import type { TicketRunResponse } from '@aisf/app/api-schemas/runs-schemas.js';

export type RoundPanelDescription =
  | { readonly kind: 'hidden' }
  | { readonly kind: 'shown'; readonly title: string; readonly url: string };

export function describeRoundPanel(response: TicketRunResponse | undefined): RoundPanelDescription {
  const waitingFor = response?.activeRun?.waitingFor;
  if (waitingFor?.kind !== 'checkpoint' || waitingFor.page === undefined) {
    return { kind: 'hidden' };
  }
  return { kind: 'shown', title: waitingFor.page.title, url: waitingFor.page.url };
}
