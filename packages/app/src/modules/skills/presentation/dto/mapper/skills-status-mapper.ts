import type { SkillsStatus } from '../../../business/domain/types/skills-status.js';
import type { SkillsStatusDto } from '../api/skills-status-dto.js';

export function toSkillsStatusDto(status: SkillsStatus): SkillsStatusDto {
  return status.state === 'failed'
    ? { state: 'failed', reason: status.reason }
    : { state: status.state };
}
