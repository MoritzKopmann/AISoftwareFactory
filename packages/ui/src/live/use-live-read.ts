import { useCallback, useEffect, useRef } from 'react';
import type { LiveUpdates } from './live-updates.js';
import type { LiveView } from './notice-concerns-view.js';
import { startLiveRead, type LiveReader } from './start-live-read.js';

export function useLiveRead<Outcome>(
  liveUpdates: LiveUpdates,
  view: LiveView,
  read: () => Promise<Outcome>,
  onOutcome: (outcome: Outcome) => void,
): { retry: () => void } {
  const latest = useRef({ read, onOutcome });
  latest.current = { read, onOutcome };
  const reader = useRef<LiveReader | undefined>(undefined);
  const retry = useCallback(() => reader.current?.retry(), []);
  const viewKey = JSON.stringify(view);

  useEffect(() => {
    const started = startLiveRead(
      liveUpdates,
      JSON.parse(viewKey) as LiveView,
      () => latest.current.read(),
      (outcome) => latest.current.onOutcome(outcome),
    );
    reader.current = started;
    return () => {
      started.stop();
      reader.current = undefined;
    };
  }, [liveUpdates, viewKey]);

  return { retry };
}
