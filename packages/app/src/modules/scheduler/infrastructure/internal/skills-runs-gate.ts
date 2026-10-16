import type { SkillsApi } from '../../../skills/index.js';
import type { RunsBlocked } from '../../business/domain/types/runs-blocked.js';
import type { RunsGate } from '../../business/port/runs/runs-gate.js';

export class SkillsRunsGate implements RunsGate {
  constructor(private readonly skills: Pick<SkillsApi, 'runsBlocked'>) {}

  check(): RunsBlocked {
    return this.skills.runsBlocked();
  }
}
