import type { RunEnding } from './run-ending.js';
import type { RunMode } from './run-mode.js';
import type { RunStage } from './run-stage.js';
import type { RunWait } from './run-wait.js';

export type Run = {
  readonly id: string;
  readonly projectId: string;
  readonly ticketNumber: number;
  readonly stage: RunStage;
  readonly mode: RunMode;
  readonly sessionId: string;
  readonly worktreePath: string;
  readonly branchName: string;
  readonly state: 'running' | 'ended' | 'settled';
  readonly waitingFor?: RunWait;
  readonly waitingSince?: string;
  readonly ending?: RunEnding;
  readonly startedAt: string;
  readonly endedAt?: string;
};
