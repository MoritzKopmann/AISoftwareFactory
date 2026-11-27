import { bugCreateSkill } from '../constants/bug-skills.js';
import { stageModels } from '../constants/stage-models.js';
import type { Run } from '../types/run.js';

const bugCreateModel = 'opus';

export function modelFor(run: Pick<Run, 'stage' | 'skill'>): string {
  return run.skill === bugCreateSkill ? bugCreateModel : stageModels[run.stage];
}
