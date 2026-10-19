import { useEffect, useState } from 'react';
import { Banner } from '../shared/banner.js';
import { describePausedBanner, readPausedUntil } from './describe-paused-banner.js';
import type { UsageState } from './use-usage.js';

export function PausedBanner({ usage }: { readonly usage: UsageState }) {
  useRerenderAt(readPausedUntil(usage));

  const description = describePausedBanner(usage, new Date());

  if (description.kind === 'hidden') return null;

  return (
    <Banner
      tone="warn"
      pulses={description.kind === 'resuming'}
      message={
        <>
          All projects paused until reset ·{' '}
          {description.kind === 'resuming' ? (
            <strong>resuming…</strong>
          ) : (
            <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{description.resetLabel}</strong>
          )}
        </>
      }
    />
  );
}

function useRerenderAt(isoTime: string | null) {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (isoTime === null) return;
    const delay = new Date(isoTime).getTime() - Date.now();
    if (delay <= 0) return;
    const timer = window.setTimeout(() => setTick((value) => value + 1), delay);
    return () => window.clearTimeout(timer);
  }, [isoTime]);
}
