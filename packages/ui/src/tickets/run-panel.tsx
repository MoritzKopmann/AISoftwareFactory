import { StopButton } from './stop-button.js';
import type { RunPanelDescription } from './describe-run-panel.js';

type RunPanelProps = {
  readonly description: RunPanelDescription;
  readonly onStop: () => void;
  readonly onRetry: () => void;
};

export function RunPanel({ description, onStop, onRetry }: RunPanelProps) {
  if (description.kind === 'hidden') {
    return null;
  }
  if (description.kind === 'ended') {
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
  const { waiting, startedLabel, stop, banner } = description;
  return (
    <section className="runpanel" aria-label="Run">
      <div className="head">
        <span className="lead">
          {waiting ? (
            <span className="shape s-hitl" aria-hidden="true">
              ●
            </span>
          ) : (
            <span className="shape s-flow pulse" aria-hidden="true">
              ●
            </span>
          )}
          {waiting ? 'Waiting for you' : 'Running'}
        </span>
        <span className="sm">{startedLabel}</span>
        <span className="grow" />
        <StopButton stop={stop} onStop={onStop} />
      </div>
      {banner !== undefined && (
        <div className="inline-banner" role="status">
          <span className="shape" aria-hidden="true">
            ▲
          </span>
          <p className="sm">{banner}</p>
          <button className="btn" type="button" onClick={onRetry}>
            Retry
          </button>
        </div>
      )}
    </section>
  );
}
