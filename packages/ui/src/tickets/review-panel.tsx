import { Fragment } from 'react';
import type { ReviewPanelDescription } from './describe-review-panel.js';

export function ReviewPanel({ description }: { readonly description: ReviewPanelDescription }) {
  if (description.kind === 'hidden') {
    return null;
  }
  return (
    <section className={`review-panel ${description.state}`} aria-label="Review">
      <div className="head">
        <h2 className="lead">
          <span className={`shape s-${description.heading.tone}`}>{description.heading.glyph}</span>
          {description.heading.text}
        </h2>
      </div>
      <div className="body">
        {description.pullRequests.map((pullRequest) => (
          <Fragment key={pullRequest.url}>
            <a className="ext" href={pullRequest.url} target="_blank" rel="noopener">
              {pullRequest.label}
            </a>
            <div className="chips">
              {pullRequest.chips.map((chip) => (
                <span key={chip.text} className={`chip ${chip.tone}`}>
                  <span className={`shape s-${chip.tone}`}>{chip.glyph}</span>
                  {chip.text}
                </span>
              ))}
            </div>
          </Fragment>
        ))}
      </div>
    </section>
  );
}
