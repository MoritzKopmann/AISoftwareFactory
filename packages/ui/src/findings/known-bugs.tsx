import { useState } from 'react';
import { useGatedSkeleton } from '../board/use-gated-skeleton.js';
import { describeKnownBugs, type KnownBugsDescription } from './describe-known-bugs.js';
import { useFindings } from './use-findings.js';

const skeletonLineWidths: ReadonlyArray<readonly [string, string]> = [
  ['75%', '45%'],
  ['60%', '35%'],
];

type KnownBugsSectionProps = {
  readonly description: KnownBugsDescription;
  readonly skeletonVisible: boolean;
  readonly onRetry: () => void;
  readonly onShowAll: () => void;
};

function KnownBugsSkeleton() {
  return (
    <section className="row findings" aria-label="Known bugs" aria-busy="true">
      <div className="row-h">
        <span className="label">Known bugs</span>
        <span className="sk" style={{ width: 14, height: 10 }} />
        <span className="vh" role="status">
          Loading known bugs…
        </span>
      </div>
      <div className="finding-box" style={{ borderColor: 'var(--border)' }}>
        {skeletonLineWidths.map(([firstWidth, secondWidth]) => (
          <div key={firstWidth} className="sk-finding">
            <span className="sk" style={{ height: 18 }} />
            <span className="lines">
              <span className="sk sk-line" style={{ width: firstWidth }} />
              <span className="sk sk-line" style={{ width: secondWidth }} />
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

export function KnownBugsSection({
  description,
  skeletonVisible,
  onRetry,
  onShowAll,
}: KnownBugsSectionProps) {
  const [open, setOpen] = useState(true);

  if (skeletonVisible) {
    return <KnownBugsSkeleton />;
  }
  if (description.kind === 'loading') {
    return null;
  }
  if (description.kind === 'error') {
    return (
      <section className="row findings" aria-label="Known bugs">
        <div className="row-h">
          <span className="label">Known bugs</span>
        </div>
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
      </section>
    );
  }
  if (description.kind === 'empty') {
    return (
      <section className="row findings" aria-label="Known bugs">
        <div className="row-h">
          <span className="label">Known bugs</span>
          <span className="n">0</span>
          <span className="none">None</span>
        </div>
      </section>
    );
  }
  const { countLabel, rows, banner, footer } = description;
  return (
    <details
      className="row findings"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className="row-h">
        <span className="chev" aria-hidden="true">
          ›
        </span>
        <span className="label">Known bugs</span>
        <span className="n">{countLabel}</span>
        <span className="toggle-text">
          <span className="t-show">Show</span>
          <span className="t-hide">Hide</span>
        </span>
      </summary>
      <div className="finding-box">
        {banner !== undefined && (
          <div className="inline-banner" role="status">
            <span className="shape" aria-hidden="true">
              ▲
            </span>
            <p className="sm">{banner}</p>
          </div>
        )}
        <ul className="finding-list">
          {rows.map((row) => (
            <li key={row.id} className="finding">
              <span className={`chip ${row.chipTone}`}>{row.chipLabel}</span>
              <div className="body">
                <p className="summary">{row.summary}</p>
                <p className="where">
                  <code className="loc">{row.location}</code>
                  <span>
                    from{' '}
                    <a href={row.sourceHref}>
                      <span className="num-id">{row.sourceLabel}</span>
                    </a>
                  </span>
                </p>
              </div>
            </li>
          ))}
        </ul>
        {footer !== undefined && (
          <div className="list-foot">
            <span>{footer}</span>
            <button className="btn" type="button" onClick={onShowAll}>
              Show all
            </button>
          </div>
        )}
      </div>
    </details>
  );
}

export function KnownBugs({ projectId }: { readonly projectId: string }) {
  const { findingsPoll, readNow } = useFindings(projectId);
  const [showAll, setShowAll] = useState(false);
  const description = describeKnownBugs(findingsPoll, projectId, showAll);
  const skeletonVisible = useGatedSkeleton(description.kind === 'loading');

  return (
    <KnownBugsSection
      description={description}
      skeletonVisible={skeletonVisible}
      onRetry={readNow}
      onShowAll={() => setShowAll(true)}
    />
  );
}
