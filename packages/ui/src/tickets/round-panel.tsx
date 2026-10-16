import { useState } from 'react';
import type { RoundPanelDescription } from './describe-round-panel.js';
import { StopButton } from './stop-button.js';

type RoundPanelProps = {
  readonly description: RoundPanelDescription;
  readonly onStop: () => void;
};

export function RoundPanel({ description, onStop }: RoundPanelProps) {
  const [loadedUrl, setLoadedUrl] = useState<string | undefined>(undefined);
  // The panel stays mounted while hidden, so a later round on the same url must load again.
  if (description.kind !== 'shown' && loadedUrl !== undefined) {
    setLoadedUrl(undefined);
  }
  if (description.kind === 'hidden') {
    return null;
  }
  if (description.kind === 'ended') {
    return (
      <section className="round-panel ended" aria-label="Round">
        <div className="head">
          <h2 className="lead">
            <span className="shape s-warn" aria-hidden="true">
              ▲
            </span>
            Run ended
          </h2>
          <span className="sm">{description.endedLabel}</span>
        </div>
        <p className="note" role="status">
          {description.note}
        </p>
      </section>
    );
  }
  const { title, url, subtitle, stop } = description;
  const loading = loadedUrl !== url;
  return (
    <section className="round-panel" aria-label={title} aria-busy={loading ? 'true' : undefined}>
      <div className="head">
        <h2 className="lead">
          <span className="shape s-hitl" aria-hidden="true">
            ●
          </span>
          Waiting for you
        </h2>
        <span className="sm">{subtitle}</span>
        <span className="grow" />
        {stop !== undefined && <StopButton stop={stop} onStop={onStop} />}
      </div>
      <div className="body">
        {loading && (
          <div className="skeleton" aria-hidden="true">
            <span className="sk sk-line" style={{ width: '18%' }} />
            <div className="card">
              <span className="sk sk-line" style={{ width: '60%' }} />
              <span className="sk answer" />
              <span className="sk answer" />
            </div>
          </div>
        )}
        <iframe
          title={title}
          src={url}
          hidden={loading}
          onLoad={() => {
            setLoadedUrl(url);
          }}
        />
      </div>
    </section>
  );
}
