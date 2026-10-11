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
  const { state, retry } = useNeedsYou(liveUpdates, projectId);
  return <NeedsYouList description={describeNeedsYou(state, projectId)} onRetry={retry} />;
}

export function NeedsYouList({
  description,
  onRetry,
}: {
  readonly description: NeedsYouDescription;
  readonly onRetry: () => void;
}) {
  return (
    <section aria-label="Needs you">
      <h2>Needs you</h2>
      {description.kind === 'failed' && (
        <div className="err" role="alert">
          <p>{description.message}</p>
          <button className="btn" type="button" onClick={onRetry}>
            Retry
          </button>
        </div>
      )}
      {description.kind === 'empty' && <p className="sm">{description.message}</p>}
      {description.kind === 'list' && (
        <ul>
          {description.entries.map((entry) => (
            <li key={entry.ticketNumber}>
              <a href={entry.href}>
                <span className="num-id">{entry.numberLabel}</span> {entry.title}
              </a>{' '}
              <span className="sm">{entry.actionText}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
