import { describe, expect, it } from 'vitest';
import { formatResetTime } from './format-reset-time.js';

const now = new Date(2026, 9, 18, 10, 0);

describe('formatResetTime', () => {
  it('should write the clock time when the reset is on the same local day', () => {
    const resetsAt = new Date(2026, 9, 18, 14, 0).toISOString();
    expect(formatResetTime(resetsAt, now)).toBe('14:00');
  });

  it('should write the weekday and clock time when the reset is on another local day', () => {
    const resetsAt = new Date(2026, 9, 19, 9, 0).toISOString();
    expect(formatResetTime(resetsAt, now)).toBe('Mon 09:00');
  });
});
