import { formatResetTime } from './format-reset-time.js';
import type { UsageState } from './use-usage.js';

export type PausedBannerDescription =
  | { readonly kind: 'hidden' }
  | { readonly kind: 'paused'; readonly resetLabel: string }
  | { readonly kind: 'resuming' };

export function readPausedUntil(usage: UsageState): string | null {
  return usage.kind === 'loaded' ? usage.usage.pausedUntil : null;
}

export function describePausedBanner(usage: UsageState, now: Date): PausedBannerDescription {
  const pausedUntil = readPausedUntil(usage);
  if (pausedUntil === null) return { kind: 'hidden' };
  const isStillPaused = new Date(pausedUntil).getTime() > now.getTime();
  if (isStillPaused) {
    return { kind: 'paused', resetLabel: formatResetTime(pausedUntil, now) };
  }
  return { kind: 'resuming' };
}
