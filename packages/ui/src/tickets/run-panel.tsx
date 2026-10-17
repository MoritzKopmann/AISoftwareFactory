import type { RunPanelDescription } from './describe-run-panel.js';

type RunPanelProps = {
  readonly description: RunPanelDescription;
};

/** The ended note only: the live head sits in the session panel. */
export function RunPanel({ description }: RunPanelProps) {
  if (description.kind !== 'ended') {
    return null;
  }
  return (
    <section className="runpanel ended" aria-label="Run">
      <div className="head">
        <span className="lead">
          <span className="shape s-warn" aria-hidden="true">
            ▲
          </span>
          Run ended
        </span>
        <span className="sm">{description.endedLabel}</span>
      </div>
      <p className="note" role="status">
        {description.note}
      </p>
    </section>
  );
}
