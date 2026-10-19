import { describe, expect, it } from 'vitest';
import type { UsageState } from './use-usage.js';
import { describePausedBanner } from './describe-paused-banner.js';

const now = new Date(2026, 9, 18, 10, 0);
const pausedLater = new Date(2026, 9, 18, 14, 0).toISOString();
const pausedBefore = new Date(2026, 9, 18, 9, 0).toISOString();
const loaded = (pausedUntil: string | null): UsageState => ({
  kind: 'loaded',
  usage: { pausedUntil, observedAt: null, fiveHour: null, sevenDay: null },
});

describe('describePausedBanner', () => {
  it('should hide the banner when usage is still loading', () => {
    expect(describePausedBanner({ kind: 'loading' }, now)).toEqual({ kind: 'hidden' });
  });

  it('should hide the banner when the usage read failed', () => {
    expect(describePausedBanner({ kind: 'failed' }, now)).toEqual({ kind: 'hidden' });
  });

  it('should hide the banner when pausedUntil is null', () => {
    expect(describePausedBanner(loaded(null), now)).toEqual({ kind: 'hidden' });
  });

  it('should return the reset label when pausedUntil is still ahead', () => {
    expect(describePausedBanner(loaded(pausedLater), now)).toEqual({
      kind: 'paused',
      resetLabel: '14:00',
    });
  });

  it('should return resuming when pausedUntil has passed', () => {
    expect(describePausedBanner(loaded(pausedBefore), now)).toEqual({ kind: 'resuming' });
  });
});
