import type { ReviewPanelDescription } from './describe-review-panel.js';

export function ReviewPanel({ description }: { readonly description: ReviewPanelDescription }) {
  if (description.kind === 'hidden') {
    return null;
  }
  return (
    <section aria-label="Review">
      <h2>Review</h2>
      <ul>
        {description.pullRequests.map((pullRequest) => (
          <li key={pullRequest.url}>
            <a className="ext" href={pullRequest.url} target="_blank" rel="noopener">
              {pullRequest.label}
            </a>{' '}
            <span className="pr-state">{pullRequest.state}</span>
            <span className="sm">
              {' '}
              · {pullRequest.approved ? 'approved' : 'not approved'} · checks {pullRequest.checks} ·{' '}
              {pullRequest.mergeable}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
