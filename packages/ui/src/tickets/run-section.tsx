import type { TicketResponse } from '@aisf/app/api-schemas/tickets-schemas.js';
import type { TicketArtifactsResponse } from '@aisf/app/api-schemas/artifacts-schemas.js';
import { useEffect, useState, type ReactNode } from 'react';
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
import { describeRunPanel, type RunPanelDescription } from './describe-run-panel.js';
import { describeSessionPanel } from './describe-session-panel.js';
import { editCheckpointDraft } from './edit-checkpoint-draft.js';
import { fetchTicketArtifacts, type TicketArtifactsFailure } from './fetch-ticket-artifacts.js';
import { PermissionPrompt } from './permission-prompt.js';
import { ResetAction } from './reset-action.js';
import { rememberRoundRun } from './remember-round-run.js';
import { resetTicket } from './reset-ticket.js';
import { RoundPanel } from './round-panel.js';
import { RunBar } from './run-bar.js';
import { describeRoundPanel } from './describe-round-panel.js';
import { RunPanel } from './run-panel.js';
import { SessionPanel } from './session-panel.js';
import { SessionViewBody } from './session-view.js';
import { startTicketRun } from './start-ticket-run.js';
import { stopTicketRun } from './stop-ticket-run.js';
import { useSessionView } from './use-session-view.js';
import { useTicketRun } from './use-ticket-run.js';

type RunSectionProps = {
  readonly liveUpdates: LiveUpdates;
  readonly projectId: string;
  readonly number: number;
  readonly ticketState: Pick<TicketResponse, 'status' | 'waiting' | 'stuck'>;
  readonly runSkill: RunSkill;
  readonly pausedUntil: string | undefined;
  readonly children: (slots: RunSlots) => ReactNode;
};

export type RunSlots = {
  readonly runBar: ReactNode;
  readonly stack: ReactNode;
  readonly reset: ReactNode;
  readonly lowerPanel: ReactNode | undefined;
  readonly session: ReactNode;
};

export function RunSection({
  liveUpdates,
  projectId,
  number,
  ticketState,
  runSkill,
  pausedUntil,
  children,
}: RunSectionProps) {
  const { status: ticketStatus, stuck: ticketStuck } = ticketState;
  const { ticketRun, retry: retryRun } = useTicketRun(liveUpdates, projectId, number);
  const session = useSessionView(liveUpdates, projectId, number);
  const [start, setStart] = useState<StartState>({ kind: 'idle' });
  const [stoppingRunId, setStoppingRunId] = useState<string | undefined>(undefined);
  const [permissionAnswer, setPermissionAnswer] = useState<PermissionAnswer>({ kind: 'idle' });
  const [checkpointAnswer, setCheckpointAnswer] = useState<CheckpointAnswer | undefined>(undefined);
  const [reset, setReset] = useState<ResetState>({ kind: 'idle' });
  const [roundRunId, setRoundRunId] = useState<string | undefined>(undefined);
  const [artifacts, setArtifacts] = useState<TicketArtifactsResponse | undefined>(undefined);
  const [artifactsFailure, setArtifactsFailure] = useState<TicketArtifactsFailure | undefined>(
    undefined,
  );
  const activeRunId = ticketRun.response?.activeRun?.id;

  useEffect(() => {
    setPermissionAnswer((current) => settlePermissionAnswer(current, ticketRun.response));
  }, [ticketRun.response]);

  useEffect(() => {
    setCheckpointAnswer((current) => settleCheckpointAnswer(current, ticketRun.response));
  }, [ticketRun.response]);

  useEffect(() => {
    setRoundRunId((current) => rememberRoundRun(current, ticketRun.response));
  }, [ticketRun.response]);

  // A failed read keeps the links from the last answer.
  const { retry: retryArtifacts } = useLiveRead(
    liveUpdates,
    { kind: 'artifacts', projectId, ticketNumber: number },
    () => fetchTicketArtifacts(projectId, number, (url) => fetch(url)),
    (outcome) => {
      if (outcome.kind === 'answer') {
        setArtifacts(outcome.response);
        setArtifactsFailure(undefined);
      } else {
        setArtifactsFailure(outcome.cause);
      }
    },
  );

  useEffect(() => {
    setStart((current) => settleStartState(current, ticketRun.response));
  }, [ticketRun.response]);

  useEffect(() => {
    setReset((current) =>
      settleResetState(current, ticketRun.response, { status: ticketStatus, stuck: ticketStuck }),
    );
  }, [ticketRun.response, ticketStatus, ticketStuck]);

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

  const prompt = describePermissionPrompt(
    ticketRun.response,
    ticketState.waiting,
    permissionAnswer,
  );

  const checkpointPrompt = describeCheckpointPrompt(
    ticketRun.response,
    ticketState.waiting,
    checkpointAnswer,
  );

  const stopping = activeRunId !== undefined && activeRunId === stoppingRunId;

  const panel = describeRunPanel(
    { ...ticketRun, ticketStuck: ticketState.stuck, pausedUntil, runSkill, stopping },
    new Date(),
  );

  const roundPanel = describeRoundPanel(ticketRun.response, {
    ticketStatus,
    ticketNumber: number,
    roundRunId,
    stopping,
  });

  // The round panel carries its own Stop and ended note, so the run panel stays out of its way.
  const shownPanel: RunPanelDescription = roundPanel.kind === 'hidden' ? panel : { kind: 'hidden' };

  const stopActiveRun = () => {
    if (activeRunId !== undefined) void stop(activeRunId);
  };

  // A round that is up fills the lower panel. Once it has ended its note joins the stack.
  const roundPanelElement = <RoundPanel description={roundPanel} onStop={stopActiveRun} />;
  const roundEnded = roundPanel.kind === 'ended';

  return children({
    runBar: (
      <RunBar
        description={describeRunBar(ticketRun.response, ticketState, start, number, runSkill)}
        onRun={() => void run()}
      />
    ),
    stack: (
      <>
        <PermissionPrompt
          description={prompt}
          onAnswer={(decision) => {
            if (prompt.kind === 'shown') {
              void answer(
                {
                  runId: prompt.runId,
                  ...(prompt.waitingSince === undefined
                    ? {}
                    : { waitingSince: prompt.waitingSince }),
                },
                decision,
              );
            }
          }}
        />
        {roundEnded && roundPanelElement}
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
        <ArtifactLinks
          description={describeArtifactLinks(artifacts, artifactsFailure)}
          onRetry={retryArtifacts}
        />
        <RunPanel description={shownPanel} />
      </>
    ),
    reset: (
      <ResetAction
        description={describeResetAction(ticketRun.response, ticketState, reset, number)}
        onReset={() => void resetToReady()}
      />
    ),
    lowerPanel: roundPanel.kind === 'shown' ? roundPanelElement : undefined,
    session: (
      <SessionPanel
        description={describeSessionPanel(shownPanel, session.view, ticketRun.response?.lastRun)}
        onRetry={retryRun}
        onStop={stopActiveRun}
        runStartedAt={(ticketRun.response?.activeRun ?? ticketRun.response?.lastRun)?.startedAt}
      >
        <SessionViewBody view={session.view} opened={session.opened} onToggle={session.toggle} />
      </SessionPanel>
    ),
  });
}
