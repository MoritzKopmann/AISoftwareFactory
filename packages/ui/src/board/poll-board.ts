import type { BoardOutcome } from './fold-board-outcome.js';

export function pollBoard(
  readOutcome: () => Promise<BoardOutcome>,
  onOutcome: (outcome: BoardOutcome) => void,
  intervalMilliseconds: number,
): () => void {
  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const poll = async () => {
    const outcome = await readOutcome();
    if (cancelled) return;
    onOutcome(outcome);
    timer = setTimeout(() => void poll(), intervalMilliseconds);
  };
  void poll();

  return () => {
    cancelled = true;
    clearTimeout(timer);
  };
}
