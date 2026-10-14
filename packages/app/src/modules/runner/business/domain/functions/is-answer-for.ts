import type { RunAnswer } from '../types/run-answer.js';
import type { RunWait } from '../types/run-wait.js';

export function isAnswerFor(wait: RunWait, answer: RunAnswer): boolean {
  return wait.kind === 'checkpoint' ? answer.kind === 'checkpoint' : answer.kind === 'permission';
}
