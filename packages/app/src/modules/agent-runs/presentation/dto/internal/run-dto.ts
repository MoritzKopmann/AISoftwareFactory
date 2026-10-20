import type { RunEndingDto, RunWaitDto } from './run-ending-dto.js';

export type RunDto = {
  readonly id: string;
  readonly projectId: string;
  readonly ticketNumber: number;
  readonly stage: 'implement' | 'spike' | 'create' | 'plan' | 'onboard';
  readonly mode: 'afk';
  readonly sessionId: string;
  readonly worktreePath: string;
  readonly branchName: string;
  readonly state: 'running' | 'ended' | 'settled';
  readonly waitingFor?: RunWaitDto;
  readonly waitingSince?: string;
  readonly ending?: RunEndingDto;
  readonly answerHeld: boolean;
  readonly startedAt: string;
  readonly endedAt?: string;
};
