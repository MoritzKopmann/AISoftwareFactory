import type { TicketRunResponse } from '@aisf/app/api-schemas/runs-schemas.js';

export function waitingPage(response: TicketRunResponse | undefined) {
  if (response?.activeRun !== undefined) {
    const waitingFor = response.activeRun.waitingFor;
    return waitingFor?.kind === 'checkpoint' ? waitingFor.page : undefined;
  }
  const ending = response?.lastRun?.ending;
  return ending?.kind === 'checkpoint' ? ending.page : undefined;
}
