import { useCallback, useEffect, useState } from 'react';
import { KnownBugs } from '../findings/known-bugs.js';
import {
  describeTicketPage,
  outcomeFromAnswer,
  type TicketPageDescription,
  type TicketPageOutcome,
} from './describe-ticket-page.js';
import { outcomeAfterRefresh } from './outcome-after-refresh.js';
import { RunSection } from './run-section.js';
import { RunLog } from './run-log.js';
import { TicketBodySection } from './ticket-body-section.js';

type TicketPageProps = {
  readonly id: string;
  readonly number: number;
};

export function TicketPage({ id, number }: TicketPageProps) {
  const [outcome, setOutcome] = useState<TicketPageOutcome>({ kind: 'loading' });

  const read = useCallback(async (): Promise<TicketPageOutcome> => {
    try {
      const response = await fetch(`/api/projects/${id}/tickets/${number}`);
      return await outcomeFromAnswer(response.status, () => response.json());
    } catch (error) {
      return {
        kind: 'request-failed',
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }, [id, number]);

  const load = useCallback(async () => {
    setOutcome({ kind: 'loading' });
    setOutcome(await read());
  }, [read]);

  const refresh = useCallback(() => {
    void read().then((refreshed) => {
      setOutcome((shown) => outcomeAfterRefresh(shown, refreshed));
    });
  }, [read]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <TicketPageView
      projectId={id}
      number={number}
      description={describeTicketPage(outcome, id, number, Date.now())}
      onRetry={() => void load()}
      onTicketStale={refresh}
    />
  );
}

type TicketPageViewProps = {
  readonly projectId: string;
  readonly number: number;
  readonly description: TicketPageDescription;
  readonly onRetry: () => void;
  readonly onTicketStale: () => void;
};

export function TicketPageView({
  projectId,
  number,
  description,
  onRetry,
  onTicketStale,
}: TicketPageViewProps) {
  return (
    <main className="page" aria-busy={description.kind === 'loading' ? 'true' : undefined}>
      {description.kind === 'loading' && (
        <span className="vh" role="status">
          {description.loadingLabel}
        </span>
      )}
      <a className="back" href={`#/projects/${projectId}`}>
        <span className="arrow" aria-hidden="true">
          ←
        </span>
        Back to the board
      </a>
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
          description={description}
          onTicketStale={onTicketStale}
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
  projectId,
  number,
  description,
  onTicketStale,
}: {
  readonly projectId: string;
  readonly number: number;
  readonly description: Extract<TicketPageDescription, { kind: 'loaded' }>;
  readonly onTicketStale: () => void;
}) {
  const { statusMark, parent, pullRequests } = description;
  return (
    <>
      <div className="ticket-head">
        <h1>
          <span className="num-id">{description.numberLabel}</span>
          {description.title}
        </h1>
        <div className="inline">
          <span className={`chip ${statusMark.tone}`}>
            <span
              className={`shape s-${statusMark.tone}${statusMark.pulses ? ' pulse' : ''}`}
              aria-hidden="true"
            >
              {statusMark.shape}
            </span>
            {description.statusLabel}
          </span>
          <a className="ext" href={description.url} target="_blank" rel="noopener">
            Open on GitHub
          </a>
        </div>
      </div>
      <RunSection
        projectId={projectId}
        number={number}
        ticketStatus={description.status}
        runSkill={description.runSkill}
        onTicketStale={onTicketStale}
      />
      <dl className="facts">
        {parent !== undefined && (
          <>
            <dt className="label">Parent</dt>
            <dd>
              <a href={parent.href}>
                <span className="num-id">{parent.numberLabel}</span> {parent.title}
              </a>
            </dd>
          </>
        )}
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
      <KnownBugs projectId={projectId} ticketNumber={number} />
      <RunLog projectId={projectId} number={number} />
      <TicketBodySection body={description.body} />
    </>
  );
}
