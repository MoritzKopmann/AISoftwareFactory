import type { ContractPreflightReportResponse } from '@aisf/app/api-schemas/projects-schemas.js';
import type { TicketResponse } from '@aisf/app/api-schemas/tickets-schemas.js';

export type OnboardingActionDescription = { readonly kind: 'shown' | 'hidden' };

export function describeOnboardingAction(
  contract: ContractPreflightReportResponse,
  tickets: ReadonlyArray<Pick<TicketResponse, 'status' | 'types'>>,
): OnboardingActionDescription {
  const hasOpenOnboardTicket = tickets.some(
    (ticket) => ticket.status !== 'closed' && ticket.types.includes('onboard'),
  );
  const isNeeded = !contract.passed && !hasOpenOnboardTicket;
  return { kind: isNeeded ? 'shown' : 'hidden' };
}
