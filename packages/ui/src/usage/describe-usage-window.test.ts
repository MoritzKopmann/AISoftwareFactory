import { describe, expect, it } from 'vitest';
import { describeUsageWindow } from './describe-usage-window.js';

const now = new Date(2026, 9, 18, 10, 0);
const resetsLater = new Date(2026, 9, 18, 14, 0).toISOString();
const resetsBefore = new Date(2026, 9, 18, 9, 0).toISOString();
const window = (utilizationPercent: number, resetsAt = resetsLater) => ({
  utilizationPercent,
  resetsAt,
});

describe('describeUsageWindow', () => {
  it.each<[number, 'info' | 'warn' | 'danger']>([
    [0, 'info'],
    [79, 'info'],
    [80, 'warn'],
    [99, 'warn'],
    [100, 'danger'],
  ])('should return the toned state when utilization is %s %%', (utilizationPercent, tone) => {
    expect(describeUsageWindow(window(utilizationPercent), now)).toMatchObject({
      noData: false,
      tone,
    });
  });

  it('should return the value label and reset label when the window has data', () => {
    expect(describeUsageWindow(window(62), now)).toMatchObject({
      noData: false,
      valueLabel: '62 %',
      resetLabel: '14:00',
      resetting: false,
    });
  });

  it('should return noData when the window is null', () => {
    expect(describeUsageWindow(null, now)).toEqual({ noData: true });
  });

  it('should mark the window resetting when resetsAt has passed', () => {
    expect(describeUsageWindow(window(100, resetsBefore), now)).toMatchObject({
      noData: false,
      resetting: true,
    });
  });

  it('should not mark the window resetting when resetsAt is still ahead', () => {
    expect(describeUsageWindow(window(100), now)).toMatchObject({ resetting: false });
  });
});
