import type { ReactNode } from 'react';
import type { SessionPanelDescription } from './describe-session-panel.js';
import { StopButton } from './stop-button.js';
import { useStickToBottom } from './use-stick-to-bottom.js';

type SessionPanelProps = {
  readonly description: SessionPanelDescription;
  readonly onStop: () => void;
  readonly onRetry: () => void;
  /** Identifies the run shown; a new value starts the chat pinned to the bottom again. */
  readonly runStartedAt?: string | undefined;
  readonly children: ReactNode;
};

export function SessionPanel({
  description,
  onStop,
  onRetry,
  runStartedAt,
  children,
}: SessionPanelProps) {
  const { head, connectionBanner } = description;
  const chatRef = useStickToBottom<HTMLDivElement>(runStartedAt);
  return (
    <section className={`session-panel rail-${description.rail}`} aria-label={description.label}>
      <div className="head">
        {head.kind === 'live' ? (
          <>
            <span className="lead">
              {head.run.waiting ? (
                <span className="shape s-hitl" aria-hidden="true">
                  ●
                </span>
              ) : (
                <span className="shape s-flow pulse" aria-hidden="true">
                  ●
                </span>
              )}
              {head.run.waiting ? 'Waiting for you' : 'Running'}
            </span>
            <span className="sm">{head.run.startedLabel}</span>
            <span className="grow" />
            <StopButton stop={head.run.stop} onStop={onStop} />
          </>
        ) : (
          <>
            <span className="lead">Session</span>
            {head.timeRange !== undefined && <span className="sm">{head.timeRange}</span>}
          </>
        )}
      </div>
      {head.kind === 'live' && head.run.banner !== undefined && (
        <div className="inline-banner" role="status">
          <span className="shape" aria-hidden="true">
            ▲
          </span>
          <p className="sm">{head.run.banner}</p>
          <button className="btn" type="button" onClick={onRetry}>
            Retry
          </button>
        </div>
      )}
      {connectionBanner !== undefined && (
        <div className="inline-banner" role="status">
          <span className="shape" aria-hidden="true">
            ▲
          </span>
          <p>
            {connectionBanner.line} <span className="sm">{connectionBanner.note}</span>
          </p>
        </div>
      )}
      <div ref={chatRef} className="chat" role="log" aria-label="Session">
        {children}
      </div>
    </section>
  );
}
