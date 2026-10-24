import type { RunStage } from '../types/run-stage.js';

export const stageSkills: Readonly<Record<RunStage, string>> = {
  implement: 'aisf:implement-ticket',
  spike: 'aisf:spike',
  onboard: 'aisf:onboard-project',
  create: 'aisf:create-ticket',
  plan: 'aisf:plan-ticket',
  design: 'aisf:design',
};
