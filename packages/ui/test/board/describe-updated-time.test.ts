import { describe, expect, it } from 'vitest';
import { describeUpdatedTime } from '../../src/board/describe-updated-time.js';

const now = new Date('2026-09-28T10:00:00.000Z');

function minutesAgo(minutes: number, extraSeconds = 0): string {
  return new Date(now.getTime() - minutes * 60_000 - extraSeconds * 1000).toISOString();
}

describe('describeUpdatedTime', () => {
  it('should say just now when the time is under a minute old', () => {
    expect(describeUpdatedTime(minutesAgo(0, 59), now)).toBe('Updated just now');
  });

  it('should say just now when the time is in the future', () => {
    expect(describeUpdatedTime(minutesAgo(-3), now)).toBe('Updated just now');
  });

  it('should count whole minutes when the time is a minute or more old', () => {
    expect(describeUpdatedTime(minutesAgo(1), now)).toBe('Updated 1 min ago');
    expect(describeUpdatedTime(minutesAgo(3, 40), now)).toBe('Updated 3 min ago');
    expect(describeUpdatedTime(minutesAgo(59, 59), now)).toBe('Updated 59 min ago');
  });

  it('should count whole hours when the time is an hour or more old', () => {
    expect(describeUpdatedTime(minutesAgo(60), now)).toBe('Updated 1 h ago');
    expect(describeUpdatedTime(minutesAgo(200), now)).toBe('Updated 3 h ago');
  });
});
