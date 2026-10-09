import { useEffect, useState } from 'react';
import type { LiveUpdates } from '../live/live-updates.js';
import { useLiveRead } from '../live/use-live-read.js';
import { fetchBoardOutcome } from './fetch-board-outcome.js';
import { foldBoardOutcome, initialBoardState, type BoardState } from './fold-board-outcome.js';

const clockIntervalMilliseconds = 60_000;

export function useProjectBoard(
  liveUpdates: LiveUpdates,
  projectId: string,
): {
  readonly state: BoardState;
  readonly now: Date;
  readonly retry: () => void;
} {
  const [state, setState] = useState<BoardState>(initialBoardState);
  const [now, setNow] = useState(() => new Date());

  const { retry } = useLiveRead(
    liveUpdates,
    { kind: 'board', projectId },
    () => fetchBoardOutcome(projectId, (url) => fetch(url)),
    (outcome) => {
      setState((previous) => foldBoardOutcome(previous, outcome));
      setNow(new Date());
    },
  );

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), clockIntervalMilliseconds);
    return () => clearInterval(timer);
  }, []);

  return { state, now, retry };
}
