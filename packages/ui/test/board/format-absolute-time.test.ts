import { describe, expect, it } from 'vitest';
import { formatAbsoluteTime } from '../../src/board/format-absolute-time.js';

describe('formatAbsoluteTime', () => {
  it('should write day, short month, year and 24-hour time in the local zone', () => {
    const isoTime = new Date(2026, 8, 28, 9, 38).toISOString();
    expect(formatAbsoluteTime(isoTime)).toBe('28 Sep 2026 09:38');
  });

  it('should pad the hour and minute when they are single digits', () => {
    const isoTime = new Date(2026, 0, 5, 0, 7).toISOString();
    expect(formatAbsoluteTime(isoTime)).toBe('5 Jan 2026 00:07');
  });
});
