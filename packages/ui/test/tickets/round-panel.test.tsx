import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { RoundPanel } from '../../src/tickets/round-panel.js';

describe('RoundPanel', () => {
  it('should render nothing when hidden', () => {
    expect(renderToStaticMarkup(<RoundPanel description={{ kind: 'hidden' }} />)).toBe('');
  });

  it('should render the title and an iframe on the url when shown', () => {
    const markup = renderToStaticMarkup(
      <RoundPanel description={{ kind: 'shown', title: 'Round 1', url: '/pages/a/index.html' }} />,
    );
    expect(markup).toContain('Round 1');
    expect(markup).toMatch(/<iframe[^>]*src="\/pages\/a\/index.html"/);
  });
});
