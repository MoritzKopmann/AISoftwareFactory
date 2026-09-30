import { describe, expect, it } from 'vitest';
import { formatClockTime } from '../../src/board/format-clock-time.js';

const isoTime = new Date(2026, 8, 30, 9, 7, 5).toISOString();

describe('formatClockTime', () => {
  it('should write padded 24-hour hours and minutes in the local zone when asked for minutes', () => {
    expect(formatClockTime(isoTime, 'minutes')).toBe('09:07');
  });

  it('should add padded seconds when asked for seconds', () => {
    expect(formatClockTime(isoTime, 'seconds')).toBe('09:07:05');
  });
});
