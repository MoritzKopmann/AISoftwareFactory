import type { ActiveRunDto } from '../dto/internal/active-run-dto.js';
import type { ActiveWaitDto } from '../dto/internal/active-wait-dto.js';
import type { AnswerRunResultDto } from '../dto/internal/answer-run-result-dto.js';
import type { PausedRunDto } from '../dto/internal/paused-run-dto.js';
import type { RunAnswerDto } from '../dto/internal/run-answer-dto.js';
import type { RunDto } from '../dto/internal/run-dto.js';
import type { StartRunRequestDto } from '../dto/internal/start-run-request-dto.js';
import type { StartRunResultDto } from '../dto/internal/start-run-result-dto.js';

/**
 * What other modules may ask of agent-runs. Only shared error kinds are thrown (for example a
 * `NotFoundError` when the ticket is unknown). Two conflicts come back as results instead,
 * because the caller tells them apart: `already-active` and `not-resumable`. `holdAnswer` lets
 * `RunNotResumableError`, a shared `ConflictError` kind, through.
 */
export interface AgentRunsApi {
  start(request: StartRunRequestDto): Promise<StartRunResultDto>;
  answer(runId: string, answer: RunAnswerDto): Promise<AnswerRunResultDto>;
  findRun(runId: string): Promise<RunDto | undefined>;
  activeRuns(projectId: string): Promise<ReadonlyArray<ActiveRunDto>>;
  activeWaits(projectId: string): Promise<ReadonlyArray<ActiveWaitDto>>;
  latestRun(projectId: string, ticketNumber: number): Promise<RunDto | undefined>;
  pausedRuns(projectId: string): Promise<ReadonlyArray<PausedRunDto>>;
  holdAnswer(runId: string, answer: RunAnswerDto): Promise<void>;
  resumePaused(runId: string): Promise<AnswerRunResultDto>;
  settle(runId: string): Promise<void>;
}
