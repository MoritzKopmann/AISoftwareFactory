import { useState } from 'react';
import type { LiveUpdates } from '../live/live-updates.js';
import { useLiveRead } from '../live/use-live-read.js';
import { fetchFindings } from './fetch-findings.js';
import { foldFindingsPoll, initialFindingsPoll, type FindingsPoll } from './fold-findings-poll.js';

export function useFindings(
  liveUpdates: LiveUpdates,
  projectId: string,
  ticketNumber?: number,
): {
  readonly findingsPoll: FindingsPoll;
  readonly retry: () => void;
} {
  const [findingsPoll, setFindingsPoll] = useState<FindingsPoll>(initialFindingsPoll);

  const { retry } = useLiveRead(
    liveUpdates,
    { kind: 'findings', projectId, ...(ticketNumber === undefined ? {} : { ticketNumber }) },
    () => fetchFindings(projectId, (url) => fetch(url), ticketNumber),
    (outcome) => {
      setFindingsPoll((previous) => foldFindingsPoll(previous, outcome, new Date().toISOString()));
    },
  );

  return { findingsPoll, retry };
}
