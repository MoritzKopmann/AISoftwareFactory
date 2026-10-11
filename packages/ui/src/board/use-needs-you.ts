import { useEffect, useState } from 'react';
import type { LiveUpdates } from '../live/live-updates.js';
import { useLiveRead } from '../live/use-live-read.js';
import {
  foldNeedsYouOutcome,
  initialNeedsYouState,
  type NeedsYouState,
} from './describe-needs-you.js';
import { fetchNeedsYou } from './fetch-needs-you.js';

const clockIntervalMilliseconds = 60_000;

export function useNeedsYou(
  liveUpdates: LiveUpdates,
  projectId: string,
): { readonly state: NeedsYouState; readonly now: Date; readonly retry: () => void } {
  const [state, setState] = useState<NeedsYouState>(initialNeedsYouState);
  const [now, setNow] = useState(() => new Date());
  const { retry } = useLiveRead(
    liveUpdates,
    { kind: 'needs-you', projectId },
    () => fetchNeedsYou(projectId, (url) => fetch(url)),
    (outcome) => {
      setState((previous) => foldNeedsYouOutcome(previous, outcome));
      setNow(new Date());
    },
  );

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), clockIntervalMilliseconds);
    return () => clearInterval(timer);
  }, []);

  return { state, now, retry };
}
