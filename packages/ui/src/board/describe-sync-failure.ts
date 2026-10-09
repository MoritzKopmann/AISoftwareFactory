import type { SyncStatusResponse } from '@aisf/app/api-schemas/tickets-schemas.js';
import type { BannerTone } from '../shared/banner.js';
import { formatClockTime } from './format-clock-time.js';

export type SyncFailureDescription = {
  readonly tone: BannerTone;
  readonly message: string;
  readonly command?: string;
  readonly hint?: string;
  readonly detail?: string;
};

const refreshFailurePrefix = "Couldn't refresh the board.";

function describeRateLimit(retryAt: string | undefined): SyncFailureDescription {
  if (retryAt === undefined) {
    return {
      tone: 'warn',
      message: `${refreshFailurePrefix} GitHub rate limit reached; the watcher tries again at its next poll.`,
    };
  }
  return {
    tone: 'warn',
    message: `${refreshFailurePrefix} GitHub rate limit reached; resuming at ${formatClockTime(retryAt, 'minutes')}.`,
  };
}

export function describeSyncFailure(sync: SyncStatusResponse): SyncFailureDescription | undefined {
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
      return describeRateLimit(sync.retryAt);
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
