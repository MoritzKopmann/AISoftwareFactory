import { describe, expect, it } from 'vitest';
import { awaitedStatusFor } from '../../../../../../src/modules/scheduler/logic/domain/functions/awaited-status-for.js';
import type { RunAnswer } from '../../../../../../src/modules/scheduler/logic/domain/types/run-answer.js';
import type { RunEnding } from '../../../../../../src/modules/scheduler/logic/domain/types/run-ending.js';

const permissionAnswer: RunAnswer = { kind: 'permission', decision: 'allow' };
const checkpointAnswer: RunAnswer = { kind: 'checkpoint', text: 'Looks good' };
const permissionEnding: RunEnding = {
  kind: 'permission-needed',
  toolName: 'Bash',
  toolInput: {},
};
const checkpointEnding: RunEnding = { kind: 'checkpoint', request: 'Check the login page' };

describe('awaitedStatusFor', () => {
  it('should return waiting when a permission answer meets a permission-needed ending', () => {
    expect(awaitedStatusFor(permissionEnding, permissionAnswer)).toBe('waiting');
  });

  it('should return waiting when a checkpoint answer meets a checkpoint ending', () => {
    expect(awaitedStatusFor(checkpointEnding, checkpointAnswer)).toBe('waiting');
  });

  it.each<[string, RunEnding, RunAnswer]>([
    ['a checkpoint ending with a permission answer', checkpointEnding, permissionAnswer],
    ['a permission-needed ending with a checkpoint answer', permissionEnding, checkpointAnswer],
    ['a finished ending with a checkpoint answer', { kind: 'finished' }, checkpointAnswer],
    [
      'an escalated ending with a permission answer',
      { kind: 'escalated', escalation: 'red', reason: 'x' },
      permissionAnswer,
    ],
  ])('should return undefined when the pair is %s', (_name, ending, answer) => {
    expect(awaitedStatusFor(ending, answer)).toBeUndefined();
  });
});
