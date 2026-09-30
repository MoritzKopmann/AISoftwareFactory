import { useEffect, useState } from 'react';
import { poll } from '../shared/poll.js';
import { ticketRunPollIntervalMilliseconds } from './ticket-run-poll-interval-milliseconds.js';
import { fetchTicketRun } from './fetch-ticket-run.js';
import {
  foldTicketRunPoll,
  initialTicketRunPoll,
  type TicketRunPoll,
} from './fold-ticket-run-poll.js';

export function useTicketRun(projectId: string, number: number): TicketRunPoll {
  const [ticketRun, setTicketRun] = useState<TicketRunPoll>(initialTicketRunPoll);

  useEffect(() => {
    setTicketRun(initialTicketRunPoll);
    return poll(
      () => fetchTicketRun(projectId, number, (url) => fetch(url)),
      (outcome) => {
        setTicketRun((previous) => foldTicketRunPoll(previous, outcome, new Date().toISOString()));
      },
      ticketRunPollIntervalMilliseconds,
    );
  }, [projectId, number]);

  return ticketRun;
}
