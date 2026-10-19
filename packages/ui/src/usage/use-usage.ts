import { useState } from 'react';
import type { UsageResponse } from '@aisf/app/api-schemas/usage-schemas.js';
import type { LiveUpdates } from '../live/live-updates.js';
import { useLiveRead } from '../live/use-live-read.js';
import { fetchUsage } from './fetch-usage.js';

export type UsageState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'loaded'; readonly usage: UsageResponse }
  | { readonly kind: 'failed' };

export function useUsage(liveUpdates: LiveUpdates): UsageState {
  const [state, setState] = useState<UsageState>({ kind: 'loading' });

  useLiveRead(
    liveUpdates,
    { kind: 'usage' },
    () => fetchUsage((url) => fetch(url)),
    (outcome) => {
      setState(
        outcome.kind === 'answer' ? { kind: 'loaded', usage: outcome.usage } : { kind: 'failed' },
      );
    },
  );

  return state;
}
