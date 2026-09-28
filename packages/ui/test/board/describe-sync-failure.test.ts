import type { SyncStatusResponse } from '@aisf/app/api-schemas/tickets-schemas.js';
import { describe, expect, it } from 'vitest';
import { describeSyncFailure } from '../../src/board/describe-sync-failure.js';

const now = new Date('2026-09-28T10:00:00.000Z');

function buildFailure(
  cause: 'auth' | 'rate-limited' | 'unavailable' | 'unexpected',
  extra: { readonly retryAt?: string } = {},
): SyncStatusResponse {
  return { state: 'failed', cause, message: 'raw message', failedAt: 'f', ...extra };
}

function retryInSeconds(seconds: number): string {
  return new Date(now.getTime() + seconds * 1000).toISOString();
}

describe('describeSyncFailure', () => {
  it('should return undefined when the sync is pending', () => {
    expect(describeSyncFailure({ state: 'pending' }, now)).toBeUndefined();
  });

  it('should return undefined when the sync is ok', () => {
    const sync = { state: 'ok', checkedAt: 'a', snapshotTakenAt: 'b' } as const;
    expect(describeSyncFailure(sync, now)).toBeUndefined();
  });

  it('should ask to log in with a copyable command and the raw message when the cause is auth', () => {
    expect(describeSyncFailure(buildFailure('auth'), now)).toEqual({
      tone: 'danger',
      message: "Can't reach GitHub: gh isn't logged in. Run:",
      command: 'gh auth login',
      hint: 'The board refreshes by itself once it works.',
      detail: 'raw message',
    });
  });

  it('should count the minutes to the retry time when rate-limited', () => {
    const description = describeSyncFailure(
      buildFailure('rate-limited', { retryAt: retryInSeconds(20 * 60) }),
      now,
    );
    expect(description).toEqual({
      tone: 'warn',
      message: "Couldn't refresh the board. GitHub rate limit reached; resuming in 20 min.",
    });
  });

  it('should round the minutes up when the retry time is not on a full minute', () => {
    const description = describeSyncFailure(
      buildFailure('rate-limited', { retryAt: retryInSeconds(61) }),
      now,
    );
    expect(description?.message).toBe(
      "Couldn't refresh the board. GitHub rate limit reached; resuming in 2 min.",
    );
  });

  it('should say at least 1 min when the retry time has passed', () => {
    const description = describeSyncFailure(
      buildFailure('rate-limited', { retryAt: retryInSeconds(-30) }),
      now,
    );
    expect(description?.message).toBe(
      "Couldn't refresh the board. GitHub rate limit reached; resuming in 1 min.",
    );
  });

  it('should defer to the next poll when rate-limited without a retry time', () => {
    expect(describeSyncFailure(buildFailure('rate-limited'), now)).toEqual({
      tone: 'warn',
      message:
        "Couldn't refresh the board. GitHub rate limit reached; the watcher tries again at its next poll.",
    });
  });

  it('should warn with the raw message when the cause is unavailable', () => {
    expect(describeSyncFailure(buildFailure('unavailable'), now)).toEqual({
      tone: 'warn',
      message:
        "Couldn't refresh the board. GitHub didn't answer; the watcher tries again at its next poll.",
      detail: 'raw message',
    });
  });

  it('should point to the aisf log with the raw message when the cause is unexpected', () => {
    expect(describeSyncFailure(buildFailure('unexpected'), now)).toEqual({
      tone: 'danger',
      message: "Couldn't refresh the board. The watcher hit an unexpected error; see the aisf log.",
      detail: 'raw message',
    });
  });
});
