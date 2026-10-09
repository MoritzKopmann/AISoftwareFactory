import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type {
  KnownBugRowAction,
  KnownBugsDescription,
} from '../../src/findings/describe-known-bugs.js';
import { KnownBugsSection } from '../../src/findings/known-bugs.js';

const ignore = () => undefined;

function render(description: KnownBugsDescription, skeletonVisible = false): string {
  return renderToStaticMarkup(
    <KnownBugsSection
      description={description}
      skeletonVisible={skeletonVisible}
      onRetry={ignore}
      onShowAll={ignore}
      onCreateTicket={ignore}
      onDismiss={ignore}
    />,
  );
}

function listWith(
  action: KnownBugRowAction,
): Extract<KnownBugsDescription, { readonly kind: 'list' }> {
  return {
    kind: 'list',
    countLabel: '1',
    rows: [
      {
        id: 3,
        chipLabel: 'Bug',
        chipTone: 'danger',
        summary: 'The retry counter is never reset.',
        location: 'packages/app/src/retry-policy.ts:42',
        source: { label: '#56', href: '#/projects/o/n/tickets/56' },
        action,
      },
    ],
  };
}

const list = listWith({ kind: 'idle' });

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

  it('should say when the list loads again between the message and Retry when the first fetch failed', () => {
    const markup = render({
      kind: 'error',
      message: "Couldn't load known bugs. Can't reach aisf.",
      detail: 'Failed to fetch',
    });

    const positions = [
      'Can&#x27;t reach aisf.',
      'Loads again on the next change, or on Retry.',
      '>Retry<',
      '>Failed to fetch<',
    ].map((part) => markup.indexOf(part));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((first, second) => first - second));
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

  it('should render the location and no source link when the row has no source', () => {
    const markup = render({
      ...list,
      rows: [
        {
          id: 3,
          chipLabel: 'Bug',
          chipTone: 'danger',
          summary: 'The retry counter is never reset.',
          location: 'packages/app/src/retry-policy.ts:42',
          action: { kind: 'idle' },
        },
      ],
    });

    expect(markup).toContain('>packages/app/src/retry-policy.ts:42<');
    expect(markup).not.toContain('from');
    expect(markup).not.toContain('tickets/56');
  });

  it('should put a Retry button under the banner message when a later poll failed', () => {
    const markup = render({ ...list, banner: "Can't reach aisf. Showing the list from 09:41." });

    expect(markup).toMatch(
      /class="inline-banner".*<p class="sm">Can&#x27;t reach aisf\. Showing the list from 09:41\.<\/p><button[^>]*>Retry<\/button><\/div>/,
    );
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

  it('should offer pressable Create ticket and Dismiss buttons when the row is idle', () => {
    const markup = render(list);

    expect(markup).toMatch(/<button[^>]*type="button"[^>]*>Create ticket<\/button>/);
    expect(markup).toMatch(/<button[^>]*type="button"[^>]*>Dismiss<\/button>/);
    expect(markup).not.toContain('aria-disabled');
  });

  it('should keep both buttons focusable but disabled, read Creating… and announce it when the row is creating', () => {
    const markup = render(listWith({ kind: 'creating' }));

    expect(markup.match(/aria-disabled="true"/g)).toHaveLength(2);
    expect(markup).not.toMatch(/\sdisabled=""/);
    expect(markup).toMatch(/<button[^>]*>.*Creating…<\/button>/);
    expect(markup).not.toContain('Create ticket');
    expect(markup).toMatch(/role="status"[^>]*>Creating a ticket</);
  });

  it('should disable both buttons and keep their labels when the row is dismissing', () => {
    const markup = render(listWith({ kind: 'dismissing' }));

    expect(markup.match(/aria-disabled="true"/g)).toHaveLength(2);
    expect(markup).toMatch(/<button[^>]*>Create ticket<\/button>/);
    expect(markup).toMatch(/<button[^>]*>Dismiss<\/button>/);
    expect(markup).not.toContain('role="status"');
  });

  it('should replace the buttons with a status linking to the new ticket when the row is created', () => {
    const markup = render(
      listWith({ kind: 'created', ticketLabel: '#212', ticketHref: '#/projects/o/n/tickets/212' }),
    );

    expect(markup).not.toContain('<button');
    expect(markup).toMatch(
      /role="status"[^>]*>.*<a href="#\/projects\/o\/n\/tickets\/212">.*#212.* created<\/a>/,
    );
  });

  it('should bring back pressable buttons and announce the error with its detail when the press failed', () => {
    const markup = render(
      listWith({
        kind: 'failed',
        message: "Couldn't create the ticket. The findings route answered 500.",
        detail: '500',
      }),
    );

    expect(markup).toMatch(/<button[^>]*>Create ticket<\/button>/);
    expect(markup).toMatch(/<button[^>]*>Dismiss<\/button>/);
    expect(markup).not.toContain('aria-disabled');
    expect(markup).toMatch(
      /role="alert"[^>]*>.*Couldn&#x27;t create the ticket. The findings route answered 500\./,
    );
    expect(markup).toContain('>500<');
  });
});
