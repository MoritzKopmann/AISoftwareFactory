import type { RunsBlocked } from '../../domain/types/runs-blocked.js';

export interface SkillPort {
  check(): RunsBlocked;
}
