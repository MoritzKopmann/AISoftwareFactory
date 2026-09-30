import type { TicketRunResponse } from '@aisf/app/api-schemas/runs-schemas.js';
import { useEffect, useState } from 'react';
import { poll } from '../shared/poll.js';
import { fetchTicketRun } from './fetch-ticket-run.js';

const pollIntervalMilliseconds = 3000;

export function useTicketRun(projectId: string, number: number): TicketRunResponse | undefined {
  const [response, setResponse] = useState<TicketRunResponse | undefined>(undefined);

  useEffect(
    () =>
      poll(
        () => fetchTicketRun(projectId, number, (url) => fetch(url)),
        (outcome) => {
          if (outcome.kind === 'answer') setResponse(outcome.response);
        },
        pollIntervalMilliseconds,
      ),
    [projectId, number],
  );

  return response;
}
