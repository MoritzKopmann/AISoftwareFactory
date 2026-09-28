import type { SyncStatusResponse } from '@aisf/app/api-schemas/tickets-schemas.js';

export function describeSyncFailure(
  sync: SyncStatusResponse,
  formatTime: (isoTime: string) => string,
): string | undefined {
  if (sync.state !== 'failed') {
    return undefined;
  }
  switch (sync.cause) {
    case 'auth':
      return sync.message;
    case 'rate-limited':
      return sync.retryAt === undefined
        ? 'GitHub rate limit reached. The app retries automatically.'
        : `GitHub rate limit reached. The app retries at ${formatTime(sync.retryAt)}.`;
    case 'unavailable':
      return `${sync.message} The app retries automatically.`;
    case 'unexpected':
      return `${sync.message} See the aisf log.`;
  }
}
