import { describe, expect, it } from 'vitest';
import { toRunAnswer } from './run-mapper.js';

describe('toRunAnswer', () => {
  it('should keep the message kind when the dto is a message', () => {
    const answer = toRunAnswer({ kind: 'message', text: 'go on' });

    expect(answer).toEqual({ kind: 'message', text: 'go on' });
  });
});
