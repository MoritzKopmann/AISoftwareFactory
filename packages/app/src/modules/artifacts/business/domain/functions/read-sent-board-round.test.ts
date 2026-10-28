import { describe, expect, it } from 'vitest';
import { readSentBoardRound } from './read-sent-board-round.js';

describe('readSentBoardRound', () => {
  it('should return the sent round when the draft holds one', () => {
    const draft = JSON.stringify({ rounds: {}, board: { sentRound: 3 } });

    expect(readSentBoardRound(draft)).toBe(3);
  });

  it('should return undefined when sentRound is null', () => {
    expect(readSentBoardRound(JSON.stringify({ board: { sentRound: null } }))).toBeUndefined();
  });

  it('should return undefined when the draft has no board', () => {
    expect(readSentBoardRound('{}')).toBeUndefined();
  });

  it('should return undefined when the draft is missing', () => {
    expect(readSentBoardRound(undefined)).toBeUndefined();
  });

  it('should return undefined when the draft is not JSON', () => {
    expect(readSentBoardRound('{nope')).toBeUndefined();
  });

  it('should return undefined when the draft is not an object', () => {
    expect(readSentBoardRound('null')).toBeUndefined();
    expect(readSentBoardRound('{"board":null}')).toBeUndefined();
  });
});
