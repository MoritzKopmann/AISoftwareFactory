import type { TicketStatusResponse } from '@aisf/app/api-schemas/tickets-schemas.js';
import { useEffect, useState } from 'react';
import { describeRunBar, type StartState } from './describe-run-bar.js';
import { describeRunPanel } from './describe-run-panel.js';
import { RunBar } from './run-bar.js';
import { RunPanel } from './run-panel.js';
import { shouldRereadTicket } from './should-reread-ticket.js';
import { startTicketRun } from './start-ticket-run.js';
import { stopTicketRun } from './stop-ticket-run.js';
import { useTicketRun } from './use-ticket-run.js';

type RunSectionProps = {
  readonly projectId: string;
  readonly number: number;
  readonly ticketStatus: TicketStatusResponse;
  readonly onTicketStale: () => void;
};

export function RunSection({ projectId, number, ticketStatus, onTicketStale }: RunSectionProps) {
  const ticketRun = useTicketRun(projectId, number);
  const [start, setStart] = useState<StartState>({ kind: 'idle' });
  const [stoppingRunId, setStoppingRunId] = useState<string | undefined>(undefined);
  const activeRunId = ticketRun.response?.activeRun?.id;

  useEffect(() => {
    if (shouldRereadTicket(ticketRun.response, ticketStatus)) onTicketStale();
  }, [ticketRun.response, ticketStatus, onTicketStale]);

  const run = async () => {
    setStart({ kind: 'starting' });
    const outcome = await startTicketRun(projectId, number, (url, requestInit) =>
      fetch(url, requestInit),
    );
    if (outcome.kind === 'failed') setStart(outcome);
  };

  const stop = async (runId: string) => {
    setStoppingRunId(runId);
    const outcome = await stopTicketRun(runId, (url, requestInit) => fetch(url, requestInit));
    if (outcome.kind === 'failed') setStoppingRunId(undefined);
  };

  const panel = describeRunPanel(
    {
      ...ticketRun,
      ticketStatus,
      stopping: activeRunId !== undefined && activeRunId === stoppingRunId,
    },
    new Date(),
  );

  return (
    <>
      <RunBar
        description={describeRunBar(ticketRun.response, start, number)}
        onRun={() => void run()}
      />
      <RunPanel
        description={panel}
        onStop={() => {
          if (activeRunId !== undefined) void stop(activeRunId);
        }}
      />
    </>
  );
}
