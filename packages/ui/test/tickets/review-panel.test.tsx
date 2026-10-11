import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { ReviewPanelDescription } from '../../src/tickets/describe-review-panel.js';
import { ReviewPanel } from '../../src/tickets/review-panel.js';

const openPanel: ReviewPanelDescription = {
  kind: 'shown',
  state: 'open',
  heading: { tone: 'hitl', glyph: '●', text: 'Review the PR' },
  pullRequests: [
    {
      label: 'PR #426',
      url: 'https://github.com/o/n/pull/426',
      chips: [
        { tone: 'flow', glyph: '●', text: 'Open' },
        { tone: 'neutral', glyph: '○', text: 'Not approved' },
      ],
    },
  ],
};

describe('ReviewPanel', () => {
  it('should render nothing when hidden', () => {
    expect(renderToStaticMarkup(<ReviewPanel description={{ kind: 'hidden' }} />)).toBe('');
  });

  it('should open the PR in a new tab when the link is followed', () => {
    const markup = renderToStaticMarkup(<ReviewPanel description={openPanel} />);
    expect(markup).toMatch(
      /<a[^>]*href="https:\/\/github.com\/o\/n\/pull\/426"[^>]*target="_blank"[^>]*rel="noopener"[^>]*>PR #426<\/a>/,
    );
  });

  it('should render the heading and every chip text when shown', () => {
    const markup = renderToStaticMarkup(<ReviewPanel description={openPanel} />);
    expect(markup).toContain('Review the PR');
    expect(markup).toContain('Open');
    expect(markup).toContain('Not approved');
  });

  it('should render no merge control when shown', () => {
    const markup = renderToStaticMarkup(<ReviewPanel description={openPanel} />);
    expect(markup).not.toMatch(/<button|<form/);
    expect(markup.toLowerCase()).not.toContain('merge');
  });
});
