import type { LiveUpdates } from '../live/live-updates.js';
import { describeNeedsYou, type NeedsYouDescription } from './describe-needs-you.js';
import { useNeedsYou } from './use-needs-you.js';

export function NeedsYou({
  liveUpdates,
  projectId,
}: {
  readonly liveUpdates: LiveUpdates;
  readonly projectId: string;
}) {
  const { state, now, retry } = useNeedsYou(liveUpdates, projectId);
  return <NeedsYouList description={describeNeedsYou(state, projectId, now)} onRetry={retry} />;
}

export function NeedsYouList({
  description,
  onRetry,
}: {
  readonly description: NeedsYouDescription;
  readonly onRetry: () => void;
}) {
  return (
    <section
      className="ny"
      aria-label="Needs you"
      aria-busy={description.kind === 'loading' ? true : undefined}
    >
      <div className="ny-h">
        <span className="shape s-hitl" aria-hidden="true">
          ●
        </span>
        <h2 className="label">Needs you</h2>
        {(description.kind === 'list' || description.kind === 'empty') && (
          <span className="label">{description.count}</span>
        )}
      </div>
      {description.kind === 'loading' && (
        <div className="ny-box">
          <div className="ny-sk">
            <span className="sk sk-line" style={{ width: '55%' }} />
            <span className="sk sk-line" style={{ width: '30%' }} />
          </div>
          <div className="ny-sk">
            <span className="sk sk-line" style={{ width: '45%' }} />
            <span className="sk sk-line" style={{ width: '25%' }} />
          </div>
        </div>
      )}
      {description.kind === 'failed' && (
        <div className="err" role="alert">
          <span className="shape" aria-hidden="true">
            ■
          </span>
          <p>{description.message}</p>
          <p className="sm">Loads again on the next change, or on Retry.</p>
          <button className="btn" type="button" onClick={onRetry}>
            Retry
          </button>
          <p className="sm mono">{description.detail}</p>
        </div>
      )}
      {description.kind === 'empty' && <p className="sm">{description.message}</p>}
      {description.kind === 'list' && (
        <div className="ny-box">
          {description.entries.map((entry) => (
            <a key={entry.ticketNumber} className="ny-row" href={entry.href}>
              <span className={`shape s-${entry.tone}`} aria-hidden="true">
                {entry.shape}
              </span>
              <span>
                <span className="num-id ny-num">{entry.numberLabel}</span>
                {entry.title}
              </span>
              <span className="ny-time">{entry.waitLabel}</span>
              <span className="sm ny-action">{entry.actionText}</span>
            </a>
          ))}
        </div>
      )}
    </section>
  );
}
