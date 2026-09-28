import type { RunEnding } from '../domain/types/run-ending.js';

export interface RunFinisher {
  finish(runId: string, ending: RunEnding): Promise<void>;
}
