import type { LiveUpdates } from './live-updates.js';
import { useLiveConnection } from './use-live-connection.js';

export function OfflineHint({ liveUpdates }: { readonly liveUpdates: LiveUpdates }) {
  const connection = useLiveConnection(liveUpdates);
  if (connection !== 'offline') return null;
  return (
    <div className="offline-hint" role="status">
      <span className="shape" aria-hidden="true">
        ○
      </span>
      <span className="label">Offline</span>
      <span className="sm">Views refresh when the connection is back.</span>
    </div>
  );
}
