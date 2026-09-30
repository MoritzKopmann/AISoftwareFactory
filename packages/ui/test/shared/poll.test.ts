import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { poll } from '../../src/shared/poll.js';

const intervalMilliseconds = 5000;

describe('poll', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should read once on start and hand the result over', async () => {
    const read = vi.fn(() => Promise.resolve('first'));
    const handleResult = vi.fn();
    poll(read, handleResult, intervalMilliseconds);

    await vi.advanceTimersByTimeAsync(0);

    expect(read).toHaveBeenCalledTimes(1);
    expect(handleResult).toHaveBeenCalledWith('first');
  });

  it('should read again one interval after each result', async () => {
    const read = vi.fn(() => Promise.resolve('result'));
    poll(read, vi.fn(), intervalMilliseconds);

    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(intervalMilliseconds - 1);
    expect(read).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(read).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(intervalMilliseconds);
    expect(read).toHaveBeenCalledTimes(3);
  });

  it('should not start another read when the previous read is still in flight', async () => {
    let finishRead: (result: string) => void = () => undefined;
    const read = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          finishRead = resolve;
        }),
    );
    poll(read, vi.fn(), intervalMilliseconds);

    await vi.advanceTimersByTimeAsync(intervalMilliseconds * 3);
    expect(read).toHaveBeenCalledTimes(1);

    finishRead('slow');
    await vi.advanceTimersByTimeAsync(intervalMilliseconds);
    expect(read).toHaveBeenCalledTimes(2);
  });

  it('should stop reading and hand over nothing more when cancelled', async () => {
    const read = vi.fn(() => Promise.resolve('result'));
    const handleResult = vi.fn();
    const cancel = poll(read, handleResult, intervalMilliseconds);

    await vi.advanceTimersByTimeAsync(0);
    cancel();
    await vi.advanceTimersByTimeAsync(intervalMilliseconds * 3);

    expect(read).toHaveBeenCalledTimes(1);
    expect(handleResult).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('should drop the result and leave no timer when cancelled while a read is in flight', async () => {
    let finishRead: (result: string) => void = () => undefined;
    const read = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          finishRead = resolve;
        }),
    );
    const handleResult = vi.fn();
    const cancel = poll(read, handleResult, intervalMilliseconds);

    cancel();
    finishRead('late');
    await vi.advanceTimersByTimeAsync(0);

    expect(handleResult).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(intervalMilliseconds * 2);
    expect(read).toHaveBeenCalledTimes(1);
  });
});
