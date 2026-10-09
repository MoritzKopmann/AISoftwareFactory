import type { SyncStatusResponse } from '@aisf/app/api-schemas/tickets-schemas.js';
import { describe, expect, it } from 'vitest';
import { formatClockTime } from '../../src/board/format-clock-time.js';
import { describeSyncFailure } from '../../src/board/describe-sync-failure.js';

function buildFailure(
  cause: 'auth' | 'rate-limited' | 'unavailable' | 'unexpected',
  extra: { readonly retryAt?: string } = {},
): SyncStatusResponse {
  return { state: 'failed', cause, message: 'raw message', failedAt: 'f', ...extra };
}

describe('describeSyncFailure', () => {
  it('should return undefined when the sync is pending', () => {
    expect(describeSyncFailure({ state: 'pending' })).toBeUndefined();
  });

  it('should return undefined when the sync is ok', () => {
    const sync = { state: 'ok', checkedAt: 'a', snapshotTakenAt: 'b' } as const;
    expect(describeSyncFailure(sync)).toBeUndefined();
  });

  it('should ask to log in with a copyable command and the raw message when the cause is auth', () => {
    expect(describeSyncFailure(buildFailure('auth'))).toEqual({
      tone: 'danger',
      message: "Can't reach GitHub: gh isn't logged in. Run:",
      command: 'gh auth login',
      hint: 'The board refreshes by itself once it works.',
      detail: 'raw message',
    });
  });

  it('should show the retry time of day when rate-limited with a retry time', () => {
    const retryAt = '2026-09-28T10:20:00.000Z';
    const description = describeSyncFailure(buildFailure('rate-limited', { retryAt }));
    expect(description).toEqual({
      tone: 'warn',
      message: `Couldn't refresh the board. GitHub rate limit reached; resuming at ${formatClockTime(retryAt, 'minutes')}.`,
    });
  });

  it('should still show the retry time when it has passed', () => {
    const retryAt = '2026-09-28T09:00:00.000Z';
    const description = describeSyncFailure(buildFailure('rate-limited', { retryAt }));
    expect(description?.message).toBe(
      `Couldn't refresh the board. GitHub rate limit reached; resuming at ${formatClockTime(retryAt, 'minutes')}.`,
    );
  });

  it('should defer to the next poll when rate-limited without a retry time', () => {
    expect(describeSyncFailure(buildFailure('rate-limited'))).toEqual({
      tone: 'warn',
      message:
        "Couldn't refresh the board. GitHub rate limit reached; the watcher tries again at its next poll.",
    });
  });

  it('should warn with the raw message when the cause is unavailable', () => {
    expect(describeSyncFailure(buildFailure('unavailable'))).toEqual({
      tone: 'warn',
      message:
        "Couldn't refresh the board. GitHub didn't answer; the watcher tries again at its next poll.",
      detail: 'raw message',
    });
  });

  it('should point to the aisf log with the raw message when the cause is unexpected', () => {
    expect(describeSyncFailure(buildFailure('unexpected'))).toEqual({
      tone: 'danger',
      message: "Couldn't refresh the board. The watcher hit an unexpected error; see the aisf log.",
      detail: 'raw message',
    });
  });
});
