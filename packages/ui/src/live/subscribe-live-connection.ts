import type { LiveUpdates } from './live-updates.js';

export function subscribeLiveConnection(
  liveUpdates: LiveUpdates,
  onChange: () => void,
): () => void {
  return liveUpdates.listen((signal) => {
    if (signal.kind === 'connection') onChange();
  });
}
