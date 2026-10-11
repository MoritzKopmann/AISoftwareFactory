import type { RunMarker } from './describe-ticket-card.js';
import { StatusShape } from './status-shape.js';

export function RunMarkerChip({ marker }: { marker: RunMarker }) {
  if (marker === 'stuck') {
    return (
      <span className="chip danger">
        <StatusShape status="stuck" />
        Stuck
      </span>
    );
  }
  if (marker === 'waiting') {
    return (
      <span className="chip hitl">
        <StatusShape status="waiting" />
        Waiting
      </span>
    );
  }
  return (
    <span className="chip flow">
      <StatusShape status="in-progress" />
      Running
    </span>
  );
}
