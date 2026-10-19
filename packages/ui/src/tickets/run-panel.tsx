import type { RunPanelDescription } from './describe-run-panel.js';

type RunPanelProps = {
  readonly description: RunPanelDescription;
};

type EndedOrPausedDescription = Extract<RunPanelDescription, { readonly kind: 'ended' | 'paused' }>;

/** The ended note or the paused head: the live head sits in the session panel. */
export function RunPanel({ description }: RunPanelProps) {
  if (!isEndedOrPaused(description)) {
    return null;
  }
  return (
    <section className="runpanel ended" aria-label="Run">
      <div className="head">
        <span className="lead">
          <span className="shape s-warn" aria-hidden="true">
            ▲
          </span>
          {description.kind === 'paused' ? description.pausedLabel : 'Run ended'}
        </span>
        <span className="sm">{description.endedLabel}</span>
      </div>
      {description.kind === 'ended' && (
        <p className="note" role="status">
          {description.note}
        </p>
      )}
    </section>
  );
}

function isEndedOrPaused(
  description: RunPanelDescription,
): description is EndedOrPausedDescription {
  return description.kind === 'ended' || description.kind === 'paused';
}
