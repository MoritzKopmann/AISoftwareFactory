import type { TicketStatusResponse } from '@aisf/app/api-schemas/tickets-schemas.js';
import type { TicketArtifactsResponse } from '@aisf/app/api-schemas/artifacts-schemas.js';
import { useEffect, useState } from 'react';
import type { LiveUpdates } from '../live/live-updates.js';
import { useLiveRead } from '../live/use-live-read.js';
import { ArtifactLinks } from './artifact-links.js';
import { answerCheckpoint } from './answer-checkpoint.js';
import { answerPermissionPrompt } from './answer-permission-prompt.js';
import { CheckpointPrompt } from './checkpoint-prompt.js';
import { describeArtifactLinks } from './describe-artifact-links.js';
import {
  describeCheckpointPrompt,
  settleCheckpointAnswer,
  type CheckpointAnswer,
} from './describe-checkpoint-prompt.js';
import {
  describePermissionPrompt,
  settlePermissionAnswer,
  type PermissionAnswer,
  type PermissionDecision,
  type PermissionWait,
} from './describe-permission-prompt.js';
import { describeResetAction, settleResetState, type ResetState } from './describe-reset-action.js';
import {
  describeRunBar,
  settleStartState,
  type RunSkill,
  type StartState,
} from './describe-run-bar.js';
import { describeRunPanel } from './describe-run-panel.js';
import { editCheckpointDraft } from './edit-checkpoint-draft.js';
import { fetchTicketArtifacts } from './fetch-ticket-artifacts.js';
import { PermissionPrompt } from './permission-prompt.js';
import { ResetAction } from './reset-action.js';
import { resetTicket } from './reset-ticket.js';
import { RunBar } from './run-bar.js';
import { RunPanel } from './run-panel.js';
import { startTicketRun } from './start-ticket-run.js';
import { stopTicketRun } from './stop-ticket-run.js';
import { useTicketRun } from './use-ticket-run.js';

type RunSectionProps = {
  readonly liveUpdates: LiveUpdates;
  readonly projectId: string;
  readonly number: number;
  readonly ticketStatus: TicketStatusResponse;
  readonly runSkill: RunSkill;
};

export function RunSection({
  liveUpdates,
  projectId,
  number,
  ticketStatus,
  runSkill,
}: RunSectionProps) {
  const { ticketRun } = useTicketRun(liveUpdates, projectId, number);
  const [start, setStart] = useState<StartState>({ kind: 'idle' });
  const [stoppingRunId, setStoppingRunId] = useState<string | undefined>(undefined);
  const [permissionAnswer, setPermissionAnswer] = useState<PermissionAnswer>({ kind: 'idle' });
  const [checkpointAnswer, setCheckpointAnswer] = useState<CheckpointAnswer | undefined>(undefined);
  const [reset, setReset] = useState<ResetState>({ kind: 'idle' });
  const [artifacts, setArtifacts] = useState<TicketArtifactsResponse | undefined>(undefined);
  const activeRunId = ticketRun.response?.activeRun?.id;

  useEffect(() => {
    setPermissionAnswer((current) => settlePermissionAnswer(current, ticketRun.response));
  }, [ticketRun.response]);

  useEffect(() => {
    setCheckpointAnswer((current) => settleCheckpointAnswer(current, ticketRun.response));
  }, [ticketRun.response]);

  // A failed read keeps the links from the last answer.
  useLiveRead(
    liveUpdates,
    { kind: 'artifacts', projectId, ticketNumber: number },
    () => fetchTicketArtifacts(projectId, number, (url) => fetch(url)),
    (outcome) => {
      if (outcome.kind === 'answer') setArtifacts(outcome.response);
    },
  );

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

  const answer = async (wait: PermissionWait, decision: PermissionDecision) => {
    setPermissionAnswer({ kind: 'answering', wait, decision });
    const outcome = await answerPermissionPrompt(wait.runId, decision, (url, requestInit) =>
      fetch(url, requestInit),
    );
    if (outcome.kind === 'failed') setPermissionAnswer({ ...outcome, wait });
  };

  const sendCheckpointAnswer = async (runId: string, draft: string) => {
    setCheckpointAnswer({ runId, draft, send: { kind: 'sending' } });
    const outcome = await answerCheckpoint(runId, draft, (url, requestInit) =>
      fetch(url, requestInit),
    );
    if (outcome.kind === 'failed') setCheckpointAnswer({ runId, draft, send: outcome });
  };

  const resetToReady = async () => {
    setReset({ kind: 'resetting' });
    const outcome = await resetTicket(projectId, number, (url, requestInit) =>
      fetch(url, requestInit),
    );
    if (outcome.kind === 'failed') setReset(outcome);
  };

  const prompt = describePermissionPrompt(ticketRun.response, ticketStatus, permissionAnswer);

  const checkpointPrompt = describeCheckpointPrompt(
    ticketRun.response,
    ticketStatus,
    checkpointAnswer,
  );

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
        description={describeRunBar(ticketRun.response, ticketStatus, start, number, runSkill)}
        onRun={() => void run()}
      />
      <PermissionPrompt
        description={prompt}
        onAnswer={(decision) => {
          if (prompt.kind === 'shown') {
            void answer(
              {
                runId: prompt.runId,
                ...(prompt.waitingSince === undefined ? {} : { waitingSince: prompt.waitingSince }),
              },
              decision,
            );
          }
        }}
      />
      <CheckpointPrompt
        description={checkpointPrompt}
        onDraftChange={(draft) => {
          if (checkpointPrompt.kind === 'shown') {
            setCheckpointAnswer((current) =>
              editCheckpointDraft(current, checkpointPrompt.runId, draft),
            );
          }
        }}
        onSend={() => {
          if (checkpointPrompt.kind === 'shown') {
            void sendCheckpointAnswer(checkpointPrompt.runId, checkpointPrompt.draft);
          }
        }}
      />
      <ArtifactLinks links={describeArtifactLinks(artifacts)} />
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
