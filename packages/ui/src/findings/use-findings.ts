import { useCallback, useEffect, useState } from 'react';
import { poll } from '../shared/poll.js';
import { fetchFindings } from './fetch-findings.js';
import { findingsPollIntervalMilliseconds } from './findings-poll-interval-milliseconds.js';
import { foldFindingsPoll, initialFindingsPoll, type FindingsPoll } from './fold-findings-poll.js';

export function useFindings(
  projectId: string,
  ticketNumber?: number,
): {
  readonly findingsPoll: FindingsPoll;
  readonly readNow: () => void;
} {
  const [findingsPoll, setFindingsPoll] = useState<FindingsPoll>(initialFindingsPoll);
  const [readCount, setReadCount] = useState(0);

  // A new read count restarts the poll, and a poll reads at once when it starts.
  useEffect(
    () =>
      poll(
        () => fetchFindings(projectId, (url) => fetch(url), ticketNumber),
        (outcome) => {
          setFindingsPoll((previous) =>
            foldFindingsPoll(previous, outcome, new Date().toISOString()),
          );
        },
        findingsPollIntervalMilliseconds,
      ),
    [projectId, ticketNumber, readCount],
  );

  const readNow = useCallback(() => setReadCount((count) => count + 1), []);

  return { findingsPoll, readNow };
}
