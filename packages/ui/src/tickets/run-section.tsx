import type { TicketStatusResponse } from '@aisf/app/api-schemas/tickets-schemas.js';
import { useEffect, useState } from 'react';
import { answerPermissionPrompt } from './answer-permission-prompt.js';
import {
  describePermissionPrompt,
  type PermissionAnswer,
  type PermissionDecision,
} from './describe-permission-prompt.js';
import { describeResetAction, settleResetState, type ResetState } from './describe-reset-action.js';
import { describeRunBar, settleStartState, type StartState } from './describe-run-bar.js';
import { describeRunPanel } from './describe-run-panel.js';
import { PermissionPrompt } from './permission-prompt.js';
import { ResetAction } from './reset-action.js';
import { resetTicket } from './reset-ticket.js';
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
  const [permissionAnswer, setPermissionAnswer] = useState<PermissionAnswer>({ kind: 'idle' });
  const [reset, setReset] = useState<ResetState>({ kind: 'idle' });
  const activeRunId = ticketRun.response?.activeRun?.id;
  const resetting = reset.kind === 'resetting';

  // The ticket is served from the Watcher's snapshot, so a reset shows only after a later read.
  useEffect(() => {
    if (resetting || shouldRereadTicket(ticketRun.response, ticketStatus)) onTicketStale();
  }, [ticketRun.response, ticketStatus, onTicketStale, resetting]);

  useEffect(() => {
    setStart((current) => settleStartState(current, ticketRun.response));
  }, [ticketRun.response]);

  useEffect(() => {
    setReset((current) => settleResetState(current, ticketRun.response, ticketStatus));
  }, [ticketRun.response, ticketStatus]);

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

  const answer = async (runId: string, decision: PermissionDecision) => {
    setPermissionAnswer({ kind: 'answering', runId, decision });
    const outcome = await answerPermissionPrompt(runId, decision, (url, requestInit) =>
      fetch(url, requestInit),
    );
    if (outcome.kind === 'failed') setPermissionAnswer({ ...outcome, runId });
  };

  const resetToReady = async () => {
    setReset({ kind: 'resetting' });
    const outcome = await resetTicket(projectId, number, (url, requestInit) =>
      fetch(url, requestInit),
    );
    if (outcome.kind === 'failed') setReset(outcome);
    else onTicketStale();
  };

  const prompt = describePermissionPrompt(ticketRun.response, ticketStatus, permissionAnswer);

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
        description={describeRunBar(ticketRun.response, ticketStatus, start, number)}
        onRun={() => void run()}
      />
      <PermissionPrompt
        description={prompt}
        onAnswer={(decision) => {
          if (prompt.kind === 'shown') void answer(prompt.runId, decision);
        }}
      />
      <RunPanel
        description={panel}
        onStop={() => {
          if (activeRunId !== undefined) void stop(activeRunId);
        }}
      />
      <ResetAction
        description={describeResetAction(ticketRun.response, ticketStatus, reset, number)}
        onReset={() => void resetToReady()}
      />
    </>
  );
}
