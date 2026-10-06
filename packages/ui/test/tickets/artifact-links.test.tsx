import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ArtifactLinks } from '../../src/tickets/artifact-links.js';

describe('ArtifactLinks', () => {
  it('should render nothing when there are no links', () => {
    expect(renderToStaticMarkup(<ArtifactLinks links={[]} />)).toBe('');
  });

  it('should render each link as an external-style anchor that opens in a new tab', () => {
    const markup = renderToStaticMarkup(
      <ArtifactLinks
        links={[{ artifactId: 'confirm', label: 'Open page: Confirm the plan', url: '/a/tok/' }]}
      />,
    );
    expect(markup).toMatch(/<a[^>]*href="\/a\/tok\/"/);
    expect(markup).toContain('target="_blank"');
    expect(markup).toContain('rel="noopener noreferrer"');
    expect(markup).toContain('class="ext"');
    expect(markup).toContain('Open page: Confirm the plan');
  });
});
