import { describe, expect, it } from 'vitest';
import { decideRoundAfterFeedback } from './decide-round-after-feedback.js';

describe('decideRoundAfterFeedback', () => {
  it('should return the next round when feedback went out for the current round', () => {
    expect(decideRoundAfterFeedback(3, 3)).toBe(4);
  });

  it('should return undefined when the round is already above the sent round', () => {
    expect(decideRoundAfterFeedback(4, 3)).toBeUndefined();
  });

  it('should return undefined when the round or the sent round is unknown', () => {
    expect(decideRoundAfterFeedback(undefined, 3)).toBeUndefined();
    expect(decideRoundAfterFeedback(3, undefined)).toBeUndefined();
  });
});
