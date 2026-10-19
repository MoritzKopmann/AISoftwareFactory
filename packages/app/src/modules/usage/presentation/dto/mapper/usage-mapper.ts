import type { UsageWindow } from '../../../business/domain/types/usage-window.js';
import type { UsageResponse } from '../api/usage-schemas.js';
import type { UsageStatusDto } from '../internal/usage-status-dto.js';

export function toUsageStatusDto(window: UsageWindow): UsageStatusDto {
  return {
    pausedUntil: window.pausedUntil,
    observedAt: window.observedAt,
    fiveHour: window.fiveHour,
    sevenDay: window.sevenDay,
  };
}

export function toUsageResponse(window: UsageWindow): UsageResponse {
  return {
    pausedUntil: window.pausedUntil,
    observedAt: window.observedAt,
    fiveHour: window.fiveHour,
    sevenDay: window.sevenDay,
  };
}
