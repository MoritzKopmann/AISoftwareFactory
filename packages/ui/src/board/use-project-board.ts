import { useEffect, useState } from 'react';
import { fetchBoardOutcome } from './fetch-board-outcome.js';
import { foldBoardOutcome, initialBoardState, type BoardState } from './fold-board-outcome.js';
import { pollBoard } from './poll-board.js';

const pollIntervalMilliseconds = 5000;
const clockIntervalMilliseconds = 60_000;

export function useProjectBoard(projectId: string): {
  readonly state: BoardState;
  readonly now: Date;
} {
  const [state, setState] = useState<BoardState>(initialBoardState);
  const [now, setNow] = useState(() => new Date());

  useEffect(
    () =>
      pollBoard(
        () => fetchBoardOutcome(projectId, (url) => fetch(url)),
        (outcome) => {
          setState((previous) => foldBoardOutcome(previous, outcome));
          setNow(new Date());
        },
        pollIntervalMilliseconds,
      ),
    [projectId],
  );

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), clockIntervalMilliseconds);
    return () => clearInterval(timer);
  }, []);

  return { state, now };
}
