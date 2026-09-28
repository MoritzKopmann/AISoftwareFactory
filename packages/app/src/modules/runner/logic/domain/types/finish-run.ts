import type { RunEnding } from './run-ending.js';

export type FinishRun = (runId: string, ending: RunEnding) => Promise<void>;
