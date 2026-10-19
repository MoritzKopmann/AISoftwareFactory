import type { RunAnswerDto } from './run-answer-dto.js';

export type PausedRunDto = {
  readonly runId: string;
  readonly ticketNumber: number;
  readonly heldAnswer: RunAnswerDto | null;
};
