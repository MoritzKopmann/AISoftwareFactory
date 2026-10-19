import { useState, type ReactNode } from 'react';
import type { LiveUpdates } from '../live/live-updates.js';
import { useLiveRead } from '../live/use-live-read.js';
import { RunMarkerChip } from '../board/run-marker-chip.js';
import { KnownBugs } from '../findings/known-bugs.js';
import {
  describeTicketPage,
  outcomeFromAnswer,
  type TicketPageDescription,
  type TicketPageOutcome,
} from './describe-ticket-page.js';
import {
  describeDescriptionSwap,
  settleDescriptionOpen,
  type DescriptionSwap,
} from './describe-description-swap.js';
import { DescriptionToggle } from './description-toggle.js';
import { describeMoveToPlanAction, type MoveToPlanState } from './describe-move-to-plan-action.js';
import { MoveToPlanAction } from './move-to-plan-action.js';
import { moveTicketToPlan } from './move-ticket-to-plan.js';
import { outcomeAfterRefresh } from './outcome-after-refresh.js';
import { ReviewPanel } from './review-panel.js';
import { RunSection } from './run-section.js';
import { TicketBodySection } from './ticket-body-section.js';
import { ticketLiveView } from './ticket-live-view.js';
import { isRequestFailure } from '../shared/is-request-failure.js';

type LoadedDescription = Extract<TicketPageDescription, { kind: 'loaded' }>;

type TicketPageProps = {
  readonly liveUpdates: LiveUpdates;
  readonly id: string;
  readonly number: number;
  readonly pausedUntil: string | undefined;
};

export function TicketPage({ liveUpdates, id, number, pausedUntil }: TicketPageProps) {
  const [outcome, setOutcome] = useState<TicketPageOutcome>({ kind: 'loading' });

  const { retry } = useLiveRead(
    liveUpdates,
    ticketLiveView(id, number, outcome),
    async (): Promise<TicketPageOutcome> => {
      try {
        const response = await fetch(`/api/projects/${id}/tickets/${number}`);
        return await outcomeFromAnswer(response.status, () => response.json());
      } catch (error) {
        if (!isRequestFailure(error)) throw error;
        return {
          kind: 'request-failed',
          message: error.message,
        };
      }
    },
    (refreshed) => setOutcome((shown) => outcomeAfterRefresh(shown, refreshed)),
  );

  return (
    <TicketPageView
      liveUpdates={liveUpdates}
      projectId={id}
      number={number}
      pausedUntil={pausedUntil}
      description={describeTicketPage(outcome, id, number)}
      onRetry={() => {
        setOutcome({ kind: 'loading' });
        retry();
      }}
    />
  );
}

type TicketPageViewProps = {
  readonly liveUpdates: LiveUpdates;
  readonly projectId: string;
  readonly number: number;
  readonly pausedUntil: string | undefined;
  readonly description: TicketPageDescription;
  readonly onRetry: () => void;
};

export function TicketPageView({
  liveUpdates,
  projectId,
  number,
  pausedUntil,
  description,
  onRetry,
}: TicketPageViewProps) {
  return (
    <main
      className={description.kind === 'loaded' ? 'page ticket-page' : 'page'}
      aria-busy={description.kind === 'loading' ? 'true' : undefined}
    >
      {description.kind === 'loading' && (
        <span className="vh" role="status">
          {description.loadingLabel}
        </span>
      )}
      {description.kind !== 'loaded' && <BackLink projectId={projectId} />}
      {description.kind === 'loading' && <TicketSkeleton />}
      {description.kind === 'not-found' && (
        <div className="err" role="alert">
          <span className="shape" aria-hidden="true">
            ■
          </span>
          <p>{description.message}</p>
        </div>
      )}
      {description.kind === 'failed' && (
        <div className="err" role="alert">
          <span className="shape" aria-hidden="true">
            ■
          </span>
          <p>
            {description.message}
            {description.command !== undefined && (
              <>
                {' '}
                <code>{description.command}</code>
              </>
            )}
          </p>
          <p className="sm">Loads again on the next change, or on Retry.</p>
          <button className="btn" type="button" onClick={onRetry}>
            Retry
          </button>
          {description.detail !== '' && <p className="sm mono">{description.detail}</p>}
        </div>
      )}
      {description.kind === 'loaded' && (
        <LoadedTicket
          projectId={projectId}
          number={number}
          pausedUntil={pausedUntil}
          description={description}
          liveUpdates={liveUpdates}
        />
      )}
    </main>
  );
}

function TicketSkeleton() {
  return (
    <>
      <div className="ticket-head">
        <span className="sk" style={{ width: '70%', height: 22 }} />
        <span className="sk" style={{ width: 110, height: 18 }} />
      </div>
      <div className="facts">
        <span className="sk sk-line" style={{ width: 60 }} />
        <span className="sk sk-line" style={{ width: '40%' }} />
        <span className="sk sk-line" style={{ width: 80 }} />
        <span className="sk sk-line" style={{ width: '25%' }} />
      </div>
    </>
  );
}

function LoadedTicket({
  liveUpdates,
  projectId,
  number,
  pausedUntil,
  description,
}: {
  readonly liveUpdates: LiveUpdates;
  readonly projectId: string;
  readonly number: number;
  readonly pausedUntil: string | undefined;
  readonly description: LoadedDescription;
}) {
  const { statusMark, parent, pullRequests } = description;
  const [moveToPlan, setMoveToPlan] = useState<MoveToPlanState>({ kind: 'idle' });
  const moveToPlanNow = async () => {
    setMoveToPlan({ kind: 'sending' });
    const outcome = await moveTicketToPlan(projectId, number, (url, requestInit) =>
      fetch(url, requestInit),
    );
    setMoveToPlan(outcome.kind === 'moved' ? { kind: 'done' } : outcome);
  };
  return (
    <RunSection
      liveUpdates={liveUpdates}
      projectId={projectId}
      number={number}
      ticketState={description}
      runSkill={description.runSkill}
      pausedUntil={pausedUntil}
    >
      {(slots) => (
        <DescriptionSwapState roundUp={slots.lowerPanel !== undefined}>
          {(swap, onToggle) => (
            <>
              <header className="tp-bar">
                <div className="tp-id">
                  <BackLink projectId={projectId} />
                  <h1>
                    <span className="num-id">{description.numberLabel}</span>
                    {description.title}
                  </h1>
                  <div className="tp-chips">
                    <span className={`chip ${statusMark.tone}`}>
                      <span
                        className={`shape s-${statusMark.tone}${statusMark.pulses ? ' pulse' : ''}`}
                        aria-hidden="true"
                      >
                        {statusMark.shape}
                      </span>
                      {description.statusLabel}
                    </span>
                    {description.marker !== undefined && (
                      <RunMarkerChip marker={description.marker} />
                    )}
                    <a className="ext" href={description.url} target="_blank" rel="noopener">
                      Open on GitHub
                    </a>
                    {parent !== undefined && (
                      <>
                        <span className="dot" aria-hidden="true">
                          ·
                        </span>
                        <span>
                          <span className="label">Parent</span>
                          <a href={parent.href}>
                            <span className="num-id">{parent.numberLabel}</span> {parent.title}
                          </a>
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <div className="tp-actions">
                  <KnownBugs
                    liveUpdates={liveUpdates}
                    projectId={projectId}
                    ticketNumber={number}
                    variant="popover"
                  />
                  <DescriptionToggle toggle={swap.toggle} onToggle={onToggle} />
                  {slots.runBar}
                </div>
              </header>
              <div className="tp-cols">
                <div className="tp-left">
                  {description.reviewPanel !== undefined && (
                    <ReviewPanel description={description.reviewPanel} />
                  )}
                  {slots.stack}
                  <MoveToPlanAction
                    description={describeMoveToPlanAction(description.status, moveToPlan, number)}
                    onMove={() => void moveToPlanNow()}
                  />
                  {slots.reset}
                  {description.reviewPanel === undefined && (
                    <PullRequestsRow pullRequests={pullRequests} />
                  )}
                  {slots.lowerPanel !== undefined && (
                    <div className="tp-lower" hidden={swap.panel !== 'round'}>
                      {slots.lowerPanel}
                    </div>
                  )}
                  {swap.panel === 'description' && <TicketBodySection body={description.body} />}
                </div>
                {slots.session}
              </div>
            </>
          )}
        </DescriptionSwapState>
      )}
    </RunSection>
  );
}

type DescriptionSwapStateProps = {
  readonly roundUp: boolean;
  readonly children: (swap: DescriptionSwap, onToggle: () => void) => ReactNode;
};

function DescriptionSwapState({ roundUp, children }: DescriptionSwapStateProps) {
  const [open, setOpen] = useState(false);
  const settled = settleDescriptionOpen(open, roundUp);
  if (settled !== open) {
    setOpen(settled);
  }
  return children(describeDescriptionSwap(roundUp, settled), () => {
    setOpen(!settled);
  });
}

function BackLink({ projectId }: { readonly projectId: string }) {
  return (
    <a className="back" href={`#/projects/${projectId}`}>
      <span className="arrow" aria-hidden="true">
        ←
      </span>
      Back to the board
    </a>
  );
}

function PullRequestsRow({
  pullRequests,
}: {
  readonly pullRequests: LoadedDescription['pullRequests'];
}) {
  return (
    <dl className="facts">
      <dt className="label">Pull requests</dt>
      {pullRequests.length === 0 ? (
        <dd className="sm">None</dd>
      ) : (
        <dd>
          <ul>
            {pullRequests.map((pullRequest) => (
              <li key={pullRequest.url}>
                <a className="ext" href={pullRequest.url} target="_blank" rel="noopener">
                  {pullRequest.label}
                </a>
                <span className="pr-state">{pullRequest.state}</span>
              </li>
            ))}
          </ul>
        </dd>
      )}
    </dl>
  );
}
