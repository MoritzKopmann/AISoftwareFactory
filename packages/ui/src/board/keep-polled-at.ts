import type { LiveNotice } from '@aisf/app/api-schemas/live-notice-schemas.js';

export function keepPolledAt(
  previous: string | undefined,
  notice: LiveNotice,
  projectId: string,
): string | undefined {
  if (
    notice.event === 'watch.updated' &&
    notice.changed === false &&
    notice.projectId === projectId
  ) {
    return notice.polledAt ?? previous;
  }
  return previous;
}
