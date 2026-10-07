import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InMemoryRunAnswerWaits } from '../../../../../src/modules/runner/infra/integrations/in-memory-run-answer-waits.js';

describe('InMemoryRunAnswerWaits', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should resolve answered and return true when deliver comes before the window', async () => {
    const waits = new InMemoryRunAnswerWaits();
    const outcome = waits.wait('run-1', 1000);

    vi.advanceTimersByTime(999);
    const delivered = waits.deliver('run-1', { kind: 'permission', decision: 'allow' });

    expect(delivered).toBe(true);
    expect(await outcome).toEqual({
      kind: 'answered',
      answer: { kind: 'permission', decision: 'allow' },
    });
  });

  it('should resolve expired when the window passes with no answer', async () => {
    const waits = new InMemoryRunAnswerWaits();
    const outcome = waits.wait('run-1', 1000);

    vi.advanceTimersByTime(1000);

    expect(await outcome).toEqual({ kind: 'expired' });
    expect(waits.deliver('run-1', { kind: 'checkpoint', text: 'late' })).toBe(false);
  });

  it('should resolve cancelled when the wait is cancelled', async () => {
    const waits = new InMemoryRunAnswerWaits();
    const outcome = waits.wait('run-1', 1000);

    waits.cancel('run-1');

    expect(await outcome).toEqual({ kind: 'cancelled' });
    expect(waits.deliver('run-1', { kind: 'checkpoint', text: 'late' })).toBe(false);
  });

  it('should return false when deliver finds no wait for the run', () => {
    expect(new InMemoryRunAnswerWaits().deliver('run-1', { kind: 'checkpoint', text: 'yes' })).toBe(
      false,
    );
  });

  it('should do nothing when cancel finds no wait for the run', () => {
    expect(() => new InMemoryRunAnswerWaits().cancel('run-1')).not.toThrow();
  });
});
