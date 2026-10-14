import type { RunsBlocked } from '../../../business/domain/types/skills-status.js';
import type { RunsBlockedDto } from '../internal/runs-blocked-dto.js';

export function toRunsBlockedDto(runsBlocked: RunsBlocked): RunsBlockedDto {
  return runsBlocked.blocked ? { blocked: true, reason: runsBlocked.reason } : { blocked: false };
}
