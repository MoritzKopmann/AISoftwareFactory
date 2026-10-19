import type { UsageResponse } from '@aisf/app/api-schemas/usage-schemas.js';

export function windowsOf(usage: UsageResponse) {
  if (usage.observedAt === null) return { fiveHour: null, sevenDay: null };
  return { fiveHour: usage.fiveHour, sevenDay: usage.sevenDay };
}
