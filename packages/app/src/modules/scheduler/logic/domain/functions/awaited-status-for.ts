import type { TicketStatus } from '../../../../../shared/ticket-status/ticket-status.js';
import type { RunAnswer } from '../types/run-answer.js';
import type { RunEnding } from '../types/run-ending.js';

export function awaitedStatusFor(ending: RunEnding, answer: RunAnswer): TicketStatus | undefined {
  if (ending.kind === 'permission-needed' && answer.kind === 'permission') {
    return 'waiting';
  }
  if (ending.kind === 'checkpoint' && answer.kind === 'checkpoint') {
    return 'waiting';
  }
  return undefined;
}
