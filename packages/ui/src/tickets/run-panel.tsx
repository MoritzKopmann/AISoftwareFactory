import type { RunPanelDescription } from './describe-run-panel.js';

type RunPanelProps = {
  readonly description: RunPanelDescription;
  readonly onStop: () => void;
};

export function RunPanel({ description, onStop }: RunPanelProps) {
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
  const { waiting, startedLabel, stop, banner, steps, emptyMessage } = description;
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
        <button
          className="btn stop"
          type="button"
          aria-disabled={stop.pressable ? undefined : 'true'}
          onClick={() => {
            if (stop.pressable) onStop();
          }}
        >
          {stop.label}
        </button>
        {stop.announcement !== undefined && (
          <span className="vh" role="status">
            {stop.announcement}
          </span>
        )}
      </div>
      {banner !== undefined && (
        <div className="inline-banner" role="status">
          <span className="shape" aria-hidden="true">
            ▲
          </span>
          <p className="sm">{banner}</p>
        </div>
      )}
      <ol className="steps">
        {emptyMessage !== undefined && (
          <li className="empty" role="status">
            {emptyMessage}
          </li>
        )}
        {steps.map((step, position) => (
          <li key={`${position} ${step.at}`} className={step.latest ? 'latest' : undefined}>
            <time dateTime={step.at}>{step.time}</time>
            <span className="what" title={step.summary}>
              {step.summary}
              {step.latest && <span className="vh"> (latest step)</span>}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
