import type { SkillsApi } from '../../../skills/index.js';
import type { RunsBlocked } from '../../business/domain/types/runs-blocked.js';
import type { SkillPort } from '../../business/port/skill/skill-port.js';

export class SkillsAdapter implements SkillPort {
  constructor(private readonly skills: Pick<SkillsApi, 'runsBlocked'>) {}

  check(): RunsBlocked {
    return this.skills.runsBlocked();
  }
}
