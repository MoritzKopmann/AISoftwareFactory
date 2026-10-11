import { useState } from 'react';
import type { LiveUpdates } from '../live/live-updates.js';
import { useLiveRead } from '../live/use-live-read.js';
import {
  foldNeedsYouOutcome,
  initialNeedsYouState,
  type NeedsYouState,
} from './describe-needs-you.js';
import { fetchNeedsYou } from './fetch-needs-you.js';

export function useNeedsYou(
  liveUpdates: LiveUpdates,
  projectId: string,
): { readonly state: NeedsYouState; readonly retry: () => void } {
  const [state, setState] = useState<NeedsYouState>(initialNeedsYouState);
  const { retry } = useLiveRead(
    liveUpdates,
    { kind: 'needs-you', projectId },
    () => fetchNeedsYou(projectId, (url) => fetch(url)),
    (outcome) => setState((previous) => foldNeedsYouOutcome(previous, outcome)),
  );
  return { state, retry };
}
