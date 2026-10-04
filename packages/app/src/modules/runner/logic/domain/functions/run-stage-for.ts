import type { RunStage } from '../types/run-stage.js';
import type { RunTarget } from '../types/run-target.js';

export function runStageFor(target: RunTarget): RunStage {
  return target.types.includes('spike') ? 'spike' : 'implement';
}
