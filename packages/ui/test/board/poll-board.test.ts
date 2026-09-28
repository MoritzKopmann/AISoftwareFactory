import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BoardOutcome } from '../../src/board/fold-board-outcome.js';
import { pollBoard } from '../../src/board/poll-board.js';

const intervalMilliseconds = 5000;

describe('pollBoard', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function scriptedReads(outcomes: ReadonlyArray<BoardOutcome>) {
    let readCount = 0;
    const readOutcome = vi.fn(() => {
      const outcome = outcomes[Math.min(readCount, outcomes.length - 1)];
      readCount += 1;
      return Promise.resolve(outcome as BoardOutcome);
    });
    return readOutcome;
  }

  it('should read once on start and hand the outcome over', async () => {
    const readOutcome = scriptedReads([{ kind: 'not-watched' }]);
    const handleOutcome = vi.fn();
    pollBoard(readOutcome, handleOutcome, intervalMilliseconds);

    await vi.advanceTimersByTimeAsync(0);

    expect(readOutcome).toHaveBeenCalledTimes(1);
    expect(handleOutcome).toHaveBeenCalledWith({ kind: 'not-watched' });
  });

  it('should read again 5 s after each answer', async () => {
    const readOutcome = scriptedReads([{ kind: 'not-watched' }]);
    pollBoard(readOutcome, vi.fn(), intervalMilliseconds);

    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(4999);
    expect(readOutcome).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(readOutcome).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(intervalMilliseconds);
    expect(readOutcome).toHaveBeenCalledTimes(3);
  });

  it('should keep polling after a failed request', async () => {
    const readOutcome = scriptedReads([{ kind: 'request-failed' }]);
    pollBoard(readOutcome, vi.fn(), intervalMilliseconds);

    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(intervalMilliseconds * 3);

    expect(readOutcome).toHaveBeenCalledTimes(4);
  });

  it('should stop reading and hand over nothing more after stop', async () => {
    const readOutcome = scriptedReads([{ kind: 'not-watched' }]);
    const handleOutcome = vi.fn();
    const stop = pollBoard(readOutcome, handleOutcome, intervalMilliseconds);

    await vi.advanceTimersByTimeAsync(0);
    stop();
    await vi.advanceTimersByTimeAsync(intervalMilliseconds * 3);

    expect(readOutcome).toHaveBeenCalledTimes(1);
    expect(handleOutcome).toHaveBeenCalledTimes(1);
  });

  it('should drop the outcome of a read that finishes after stop', async () => {
    let finishRead: (outcome: BoardOutcome) => void = () => undefined;
    const readOutcome = vi.fn(
      () =>
        new Promise<BoardOutcome>((resolve) => {
          finishRead = resolve;
        }),
    );
    const handleOutcome = vi.fn();
    const stop = pollBoard(readOutcome, handleOutcome, intervalMilliseconds);

    stop();
    finishRead({ kind: 'not-watched' });
    await vi.advanceTimersByTimeAsync(intervalMilliseconds * 2);

    expect(handleOutcome).not.toHaveBeenCalled();
    expect(readOutcome).toHaveBeenCalledTimes(1);
  });
});
