import type { TicketRunResponse } from '@aisf/app/api-schemas/runs-schemas.js';

export function waitingPage(response: TicketRunResponse | undefined) {
  const waitingFor = response?.activeRun?.waitingFor;
  return waitingFor?.kind === 'checkpoint' ? waitingFor.page : undefined;
}
