import type { CheckpointAnswer } from './describe-checkpoint-prompt.js';

export function editCheckpointDraft(
  answer: CheckpointAnswer | undefined,
  runId: string,
  draft: string,
): CheckpointAnswer {
  return answer?.runId === runId ? { ...answer, draft } : { runId, draft, send: { kind: 'idle' } };
}
