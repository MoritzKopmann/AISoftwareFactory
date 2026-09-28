import { describe, expect, it } from 'vitest';
import { describeSyncFailure } from '../../src/board/describe-sync-failure.js';

const formatTime = (isoTime: string): string => `<${isoTime}>`;

describe('describeSyncFailure', () => {
  it('should return undefined when the sync is pending', () => {
    expect(describeSyncFailure({ state: 'pending' }, formatTime)).toBeUndefined();
  });

  it('should return undefined when the sync is ok', () => {
    const sync = { state: 'ok', checkedAt: 'a', snapshotTakenAt: 'b' } as const;
    expect(describeSyncFailure(sync, formatTime)).toBeUndefined();
  });

  it('should return the message as is when the cause is auth', () => {
    const sync = {
      state: 'failed',
      cause: 'auth',
      message: 'Not logged in: run gh auth login.',
      failedAt: 'a',
    } as const;
    expect(describeSyncFailure(sync, formatTime)).toBe('Not logged in: run gh auth login.');
  });

  it('should name the formatted retry time when the cause is rate-limited', () => {
    const sync = {
      state: 'failed',
      cause: 'rate-limited',
      message: 'limit',
      failedAt: 'a',
      retryAt: '10:30',
    } as const;
    expect(describeSyncFailure(sync, formatTime)).toBe(
      'GitHub rate limit reached. The app retries at <10:30>.',
    );
  });

  it('should say the app retries automatically when rate-limited without a retry time', () => {
    const sync = {
      state: 'failed',
      cause: 'rate-limited',
      message: 'limit',
      failedAt: 'a',
    } as const;
    expect(describeSyncFailure(sync, formatTime)).toBe(
      'GitHub rate limit reached. The app retries automatically.',
    );
  });

  it('should say the app retries automatically when the cause is unavailable', () => {
    const sync = {
      state: 'failed',
      cause: 'unavailable',
      message: 'GitHub is down.',
      failedAt: 'a',
    } as const;
    expect(describeSyncFailure(sync, formatTime)).toBe(
      'GitHub is down. The app retries automatically.',
    );
  });

  it('should point to the aisf log when the cause is unexpected', () => {
    const sync = {
      state: 'failed',
      cause: 'unexpected',
      message: 'Boom.',
      failedAt: 'a',
    } as const;
    expect(describeSyncFailure(sync, formatTime)).toBe('Boom. See the aisf log.');
  });
});
