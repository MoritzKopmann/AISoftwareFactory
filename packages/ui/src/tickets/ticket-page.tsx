import { useCallback, useEffect, useState } from 'react';
import {
  describeTicketPage,
  outcomeFromAnswer,
  type TicketPageDescription,
  type TicketPageOutcome,
} from './describe-ticket-page.js';

type TicketPageProps = {
  readonly id: string;
  readonly number: number;
};

export function TicketPage({ id, number }: TicketPageProps) {
  const [outcome, setOutcome] = useState<TicketPageOutcome>({ kind: 'loading' });

  const load = useCallback(async () => {
    setOutcome({ kind: 'loading' });
    try {
      const response = await fetch(`/api/projects/${id}/tickets/${number}`);
      setOutcome(await outcomeFromAnswer(response.status, () => response.json()));
    } catch (error) {
      setOutcome({
        kind: 'request-failed',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }, [id, number]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <TicketPageView
      projectId={id}
      description={describeTicketPage(outcome, id, number, Date.now())}
      onRetry={() => void load()}
    />
  );
}

type TicketPageViewProps = {
  readonly projectId: string;
  readonly description: TicketPageDescription;
  readonly onRetry: () => void;
};

export function TicketPageView({ projectId, description, onRetry }: TicketPageViewProps) {
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
      {description.kind === 'loaded' && <LoadedTicket description={description} />}
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
  description,
}: {
  readonly description: Extract<TicketPageDescription, { kind: 'loaded' }>;
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
    </>
  );
}
