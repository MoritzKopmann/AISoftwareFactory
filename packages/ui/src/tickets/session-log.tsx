import { useMemo, useState } from 'react';
import { createSessionLogLoader } from './create-session-log-loader.js';
import {
  describeSessionLog,
  type SessionLogDescription,
  type SessionLogState,
} from './describe-session-log.js';
import { fetchSessionLog } from './fetch-session-log.js';

type SessionLogProps = {
  readonly projectId: string;
  readonly number: number;
};

export function SessionLog({ projectId, number }: SessionLogProps) {
  const [state, setState] = useState<SessionLogState>({ kind: 'closed' });
  const loader = useMemo(
    () =>
      createSessionLogLoader(
        () => fetchSessionLog(projectId, number, (url) => fetch(url)),
        setState,
      ),
    [projectId, number],
  );

  return (
    <SessionLogView
      description={describeSessionLog(state)}
      onToggle={(open) => void loader.toggle(open)}
      onRetry={() => void loader.retry()}
    />
  );
}

type SessionLogViewProps = {
  readonly description: SessionLogDescription;
  readonly onToggle: (open: boolean) => void;
  readonly onRetry: () => void;
};

const skeletonLineWidths = ['62%', '48%', '70%', '36%'];

export function SessionLogView({ description, onToggle, onRetry }: SessionLogViewProps) {
  return (
    <details
      className="row sessionlog"
      open={description.kind !== 'closed'}
      aria-busy={description.kind === 'loading' ? 'true' : undefined}
      onToggle={(event) => {
        onToggle(event.currentTarget.open);
      }}
    >
      <summary className="row-h">
        <span className="chev" aria-hidden="true">
          ›
        </span>
        <span className="label">Session log</span>
        {description.kind === 'entries' && <span className="n">{description.countLabel}</span>}
        <span className="toggle-text">
          <span className="t-show">Show log</span>
          <span className="t-hide">Hide log</span>
        </span>
      </summary>
      {description.kind === 'loading' && (
        <div className="log-box">
          <span className="vh" role="status">
            {description.loadingLabel}
          </span>
          <div className="sk-log">
            {skeletonLineWidths.map((width) => (
              <span key={width} className="sk sk-line" style={{ width }} />
            ))}
          </div>
        </div>
      )}
      {description.kind === 'entries' && (
        <div className="log-box">
          {description.note !== undefined && <p className="log-note">{description.note}</p>}
          <ol className="log" tabIndex={0} aria-label="Session log entries">
            {description.entries.map((entry) => (
              <li key={entry.indexLabel}>
                <span className="idx">{entry.indexLabel}</span>
                <span className="what">{entry.summary}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
      {description.kind === 'message' && (
        <div className="log-box">
          <p className="log-msg" role="status">
            {description.message}
          </p>
        </div>
      )}
      {description.kind === 'failed' && (
        <div className="err" role="alert">
          <span className="shape" aria-hidden="true">
            ■
          </span>
          <p>{description.message}</p>
          <button className="btn" type="button" onClick={onRetry}>
            Retry
          </button>
          <p className="sm mono">{description.detail}</p>
        </div>
      )}
    </details>
  );
}
