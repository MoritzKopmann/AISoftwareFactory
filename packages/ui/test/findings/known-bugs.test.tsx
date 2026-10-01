import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { KnownBugsDescription } from '../../src/findings/describe-known-bugs.js';
import { KnownBugsSection } from '../../src/findings/known-bugs.js';

const ignore = () => undefined;

function render(description: KnownBugsDescription, skeletonVisible = false): string {
  return renderToStaticMarkup(
    <KnownBugsSection
      description={description}
      skeletonVisible={skeletonVisible}
      onRetry={ignore}
      onShowAll={ignore}
    />,
  );
}

const list: KnownBugsDescription = {
  kind: 'list',
  countLabel: '1',
  rows: [
    {
      id: 3,
      chipLabel: 'Bug',
      chipTone: 'danger',
      summary: 'The retry counter is never reset.',
      location: 'packages/app/src/retry-policy.ts:42',
      sourceLabel: '#56',
      sourceHref: '#/projects/o/n/tickets/56',
    },
  ],
};

describe('KnownBugsSection', () => {
  it('should render nothing when loading and the skeleton gate is closed', () => {
    expect(render({ kind: 'loading' })).toBe('');
  });

  it('should mark the section busy and announce loading when the skeleton gate is open', () => {
    const markup = render({ kind: 'loading' }, true);

    expect(markup).toContain('aria-busy="true"');
    expect(markup).toMatch(/role="status"[^>]*>Loading known bugs…</);
  });

  it('should keep the skeleton up when the gate is still open after the list arrived', () => {
    expect(render(list, true)).toContain('aria-busy="true"');
  });

  it('should announce a failed first fetch through an alert with the message, Retry and the detail', () => {
    const markup = render({
      kind: 'error',
      message: "Couldn't load known bugs. Can't reach aisf.",
      detail: 'Failed to fetch',
    });

    expect(markup).toContain('role="alert"');
    expect(markup).toContain('Couldn&#x27;t load known bugs. Can&#x27;t reach aisf.');
    expect(markup).toMatch(/<button[^>]*>Retry</);
    expect(markup).toContain('>Failed to fetch<');
  });

  it('should show the label, 0 and None without a toggle when empty', () => {
    const markup = render({ kind: 'empty' });

    expect(markup).toContain('aria-label="Known bugs"');
    expect(markup).toContain('>0<');
    expect(markup).toContain('>None<');
    expect(markup).not.toContain('<summary');
  });

  it('should render the list open by default with the count and a Show and Hide toggle', () => {
    const markup = render(list);

    expect(markup).toMatch(/<details[^>]* open=""/);
    expect(markup).toContain('>1<');
    expect(markup).toContain('>Show<');
    expect(markup).toContain('>Hide<');
  });

  it('should render a row with its chip, summary, location and the link to the source ticket', () => {
    const markup = render(list);

    expect(markup).toContain('>Bug<');
    expect(markup).toContain('>The retry counter is never reset.<');
    expect(markup).toContain('>packages/app/src/retry-policy.ts:42<');
    expect(markup).toMatch(/from <a href="#\/projects\/o\/n\/tickets\/56">.*#56/);
  });

  it('should render neither a banner nor a footer when the description has none', () => {
    const markup = render(list);

    expect(markup).not.toContain('role="status"');
    expect(markup).not.toContain('Show all');
  });

  it('should announce the banner through a status region when a later poll failed', () => {
    const markup = render({ ...list, banner: "Can't reach aisf. Showing the list from 09:41." });

    expect(markup).toMatch(/role="status".*Can&#x27;t reach aisf. Showing the list from 09:41\./);
  });

  it('should render the footer text and a Show all button when the list is cut', () => {
    const markup = render({ ...list, footer: 'Showing 20 of 34.' });

    expect(markup).toContain('>Showing 20 of 34.<');
    expect(markup).toMatch(/<button[^>]*>Show all</);
  });
});
