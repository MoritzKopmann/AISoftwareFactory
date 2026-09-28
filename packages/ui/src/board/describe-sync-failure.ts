import type { SyncStatusResponse } from '@aisf/app/api-schemas/tickets-schemas.js';
import type { BannerTone } from '../shared/banner.js';

export type SyncFailureDescription = {
  readonly tone: BannerTone;
  readonly message: string;
  readonly command?: string;
  readonly hint?: string;
  readonly detail?: string;
};

const millisecondsPerMinute = 60_000;
const refreshFailurePrefix = "Couldn't refresh the board.";

function describeRateLimit(retryAt: string | undefined, now: Date): SyncFailureDescription {
  if (retryAt === undefined) {
    return {
      tone: 'warn',
      message: `${refreshFailurePrefix} GitHub rate limit reached; the watcher tries again at its next poll.`,
    };
  }
  const minutesUntilRetry = Math.max(
    1,
    Math.ceil((Date.parse(retryAt) - now.getTime()) / millisecondsPerMinute),
  );
  return {
    tone: 'warn',
    message: `${refreshFailurePrefix} GitHub rate limit reached; resuming in ${minutesUntilRetry} min.`,
  };
}

export function describeSyncFailure(
  sync: SyncStatusResponse,
  now: Date,
): SyncFailureDescription | undefined {
  if (sync.state !== 'failed') {
    return undefined;
  }
  switch (sync.cause) {
    case 'auth':
      return {
        tone: 'danger',
        message: "Can't reach GitHub: gh isn't logged in. Run:",
        command: 'gh auth login',
        hint: 'The board refreshes by itself once it works.',
        detail: sync.message,
      };
    case 'rate-limited':
      return describeRateLimit(sync.retryAt, now);
    case 'unavailable':
      return {
        tone: 'warn',
        message: `${refreshFailurePrefix} GitHub didn't answer; the watcher tries again at its next poll.`,
        detail: sync.message,
      };
    case 'unexpected':
      return {
        tone: 'danger',
        message: `${refreshFailurePrefix} The watcher hit an unexpected error; see the aisf log.`,
        detail: sync.message,
      };
  }
}
