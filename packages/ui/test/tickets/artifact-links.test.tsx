import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { ArtifactLinksDescription } from '../../src/tickets/describe-artifact-links.js';
import { ArtifactLinks } from '../../src/tickets/artifact-links.js';

const ignore = () => undefined;
const link = { artifactId: 'confirm', label: 'Open page: Confirm the plan', url: '/a/tok/' };
const error = {
  message: "Couldn't load the artifact links. Can't reach aisf.",
  hint: 'Loads again on the next change, or on Retry.',
  detail: 'Failed to fetch',
};

function render(description: ArtifactLinksDescription): string {
  return renderToStaticMarkup(<ArtifactLinks description={description} onRetry={ignore} />);
}

describe('ArtifactLinks', () => {
  it('should render nothing when there are no links and no error', () => {
    expect(render({ links: [] })).toBe('');
  });

  it('should render each link as an external-style anchor that opens in a new tab', () => {
    const markup = render({ links: [link] });
    expect(markup).toMatch(/<a[^>]*href="\/a\/tok\/"/);
    expect(markup).toContain('target="_blank"');
    expect(markup).toContain('rel="noopener noreferrer"');
    expect(markup).toContain('class="ext"');
    expect(markup).toContain('Open page: Confirm the plan');
    expect(markup).not.toContain('role="alert"');
  });

  it('should render the error as an alert with message, hint, Retry and detail in that order', () => {
    const markup = render({ links: [], error });
    expect(markup).not.toContain('<ul');
    expect(markup).toMatch(
      /role="alert".*Couldn&#x27;t load the artifact links\. Can&#x27;t reach aisf\..*Loads again on the next change, or on Retry\..*<button[^>]*>Retry<\/button>.*Failed to fetch/,
    );
  });

  it('should keep the links above the error when both are present', () => {
    const markup = render({ links: [link], error });
    expect(markup.indexOf('Open page: Confirm the plan')).toBeLessThan(
      markup.indexOf('role="alert"'),
    );
  });
});
