import { describe, expect, it } from 'vitest';
import { isAnswerFor } from '../../../../../../src/modules/runner/logic/domain/functions/is-answer-for.js';

const checkpointWait = { kind: 'checkpoint', request: 'Pick one' } as const;
const permissionWait = {
  kind: 'permission-needed',
  toolName: 'Bash',
  toolInput: { command: 'ls' },
} as const;
const checkpointAnswer = { kind: 'checkpoint', text: 'B' } as const;
const permissionAnswer = { kind: 'permission', decision: 'allow' } as const;

describe('isAnswerFor', () => {
  it.each([
    [checkpointWait, checkpointAnswer, true],
    [checkpointWait, permissionAnswer, false],
    [permissionWait, permissionAnswer, true],
    [permissionWait, checkpointAnswer, false],
  ] as const)('should match answer to wait by kind', (wait, answer, expected) => {
    expect(isAnswerFor(wait, answer)).toBe(expected);
  });
});
