import { describe, expect, it } from 'vitest';
import { describeTimeAgo } from '../../src/board/describe-time-ago.js';

const now = new Date('2026-09-28T10:00:00.000Z');

function minutesAgo(minutes: number, extraSeconds = 0): string {
  return new Date(now.getTime() - minutes * 60_000 - extraSeconds * 1000).toISOString();
}

describe('describeTimeAgo', () => {
  it('should say just now when the time is under a minute old', () => {
    expect(describeTimeAgo(minutesAgo(0, 30), now)).toBe('just now');
  });

  it('should count whole minutes when the time is a minute or more old', () => {
    expect(describeTimeAgo(minutesAgo(4), now)).toBe('4 min ago');
  });

  it('should count whole hours when the time is an hour or more old', () => {
    expect(describeTimeAgo(minutesAgo(125), now)).toBe('2 h ago');
  });
});
