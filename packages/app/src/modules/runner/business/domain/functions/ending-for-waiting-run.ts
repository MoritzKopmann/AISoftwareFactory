import type { Run } from '../types/run.js';
import type { RunEnding } from '../types/run-ending.js';

export function endingForWaitingRun(run: Run, ending: RunEnding): RunEnding {
  if (run.waitingFor === undefined || ending.kind === 'stopped') {
    return ending;
  }
  return run.waitingFor;
}
