import type { TicketRunResponse } from '@aisf/app/api-schemas/runs-schemas.js';
import { waitingPage } from './waiting-page.js';

export function rememberRoundRun(
  rememberedRunId: string | undefined,
  response: TicketRunResponse | undefined,
): string | undefined {
  const activeRun = response?.activeRun;
  if (activeRun === undefined) {
    return rememberedRunId;
  }
  return waitingPage(response) === undefined ? undefined : activeRun.id;
}
