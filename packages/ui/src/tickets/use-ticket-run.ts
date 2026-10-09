import { useState } from 'react';
import type { LiveUpdates } from '../live/live-updates.js';
import { useLiveRead } from '../live/use-live-read.js';
import { fetchTicketRun } from './fetch-ticket-run.js';
import {
  foldTicketRunPoll,
  initialTicketRunPoll,
  type TicketRunPoll,
} from './fold-ticket-run-poll.js';

export function useTicketRun(
  liveUpdates: LiveUpdates,
  projectId: string,
  number: number,
): { readonly ticketRun: TicketRunPoll; readonly retry: () => void } {
  const [ticketRun, setTicketRun] = useState<TicketRunPoll>(initialTicketRunPoll);

  const { retry } = useLiveRead(
    liveUpdates,
    { kind: 'run', projectId, ticketNumber: number },
    () => fetchTicketRun(projectId, number, (url) => fetch(url)),
    (outcome) => {
      setTicketRun((previous) => foldTicketRunPoll(previous, outcome, new Date().toISOString()));
    },
  );

  return { ticketRun, retry };
}
