import { useSyncExternalStore } from 'react';
import type { LiveConnection, LiveUpdates } from './live-updates.js';
import { subscribeLiveConnection } from './subscribe-live-connection.js';

export function useLiveConnection(liveUpdates: LiveUpdates): LiveConnection {
  const readConnection = () => liveUpdates.connection();
  return useSyncExternalStore(
    (onChange) => subscribeLiveConnection(liveUpdates, onChange),
    readConnection,
    readConnection,
  );
}
