import type { RunStage } from '../types/run-stage.js';

export function isAuthoringStage(stage: RunStage): boolean {
  return stage === 'create' || stage === 'plan' || stage === 'design';
}
