import type { TicketType } from '../../../../../shared/ticket-type/ticket-type.js';
import { skillImplementSkill, skillPlanSkill } from '../constants/skill-skills.js';
import { stageSkills } from '../constants/stage-skills.js';
import { uiImplementSkill, uiPlanSkill } from '../constants/ui-skills.js';
import type { RunStage } from '../types/run-stage.js';

/** The skill a run starts. A UI or skill ticket uses its own split skills for plan and implement. */
export function skillFor(stage: RunStage, types: ReadonlyArray<TicketType>): string {
  if (types.includes('ui')) {
    if (stage === 'plan') {
      return uiPlanSkill;
    }
    if (stage === 'implement') {
      return uiImplementSkill;
    }
  }
  if (types.includes('skill')) {
    if (stage === 'plan') {
      return skillPlanSkill;
    }
    if (stage === 'implement') {
      return skillImplementSkill;
    }
  }
  return stageSkills[stage];
}
