import { describe, expect, it } from 'vitest';
import type {
  CheckpointAnswer,
  CheckpointSend,
} from '../../src/tickets/describe-checkpoint-prompt.js';
import { editCheckpointDraft } from '../../src/tickets/edit-checkpoint-draft.js';

describe('editCheckpointDraft', () => {
  it('should keep the failed send when the draft changes on the same run', () => {
    const failed: CheckpointSend = { kind: 'failed', message: 'Gone.', status: 409 };
    const answer: CheckpointAnswer = { runId: 'run-1', draft: 'B.', send: failed };
    expect(editCheckpointDraft(answer, 'run-1', 'B. Leave them out.')).toEqual({
      runId: 'run-1',
      draft: 'B. Leave them out.',
      send: failed,
    });
  });

  it.each<[string, CheckpointAnswer | undefined]>([
    ['no answer exists', undefined],
    [
      'the answer belongs to an earlier run',
      { runId: 'run-1', draft: 'B.', send: { kind: 'failed', message: 'Gone.' } },
    ],
  ])('should start an idle answer for the run when the draft changes and %s', (_case, answer) => {
    expect(editCheckpointDraft(answer, 'run-2', 'A')).toEqual({
      runId: 'run-2',
      draft: 'A',
      send: { kind: 'idle' },
    });
  });
});
