import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { LiveUpdates } from '../live/live-updates.js';
import type { TicketPageDescription } from './describe-ticket-page.js';
import type { TicketImage } from './fetch-ticket-images.js';
import { TicketPageView } from './ticket-page.js';

const ignore = () => undefined;
const liveUpdates: LiveUpdates = { listen: () => ignore, connection: () => 'open' };

type LoadedDescription = Extract<TicketPageDescription, { kind: 'loaded' }>;

function loaded(overrides: Partial<LoadedDescription> = {}): LoadedDescription {
  return {
    kind: 'loaded',
    numberLabel: '#56',
    title: 'Retry a failed upload',
    status: 'ready',
    waiting: false,
    stuck: false,
    statusLabel: 'Ready',
    statusMark: { shape: '○', tone: 'neutral', pulses: false },
    url: 'https://github.com/o/n/issues/56',
    body: 'Some body',
    runSkill: 'implement-ticket',
    ...overrides,
  };
}

function render(
  description: TicketPageDescription,
  number = 56,
  images: readonly TicketImage[] = [],
): string {
  return renderToStaticMarkup(
    <TicketPageView
      liveUpdates={liveUpdates}
      projectId="o/n"
      number={number}
      pausedUntil={undefined}
      description={description}
      images={images}
      onRetry={ignore}
    />,
  );
}

describe('TicketPageView', () => {
  it('should hold the session in the right column and the description at the bottom of the left column when the ticket is loaded', () => {
    const markup = render(loaded());

    expect(markup).not.toContain('runlog');
    expect(markup).not.toContain('class="steps"');
    expect(markup).toMatch(
      /<main class="page ticket-page">.*<\/header><div class="tp-cols"><div class="tp-left">.*<section class="ticket-body" id="ticket-description" aria-label="Description">.*<\/section><\/div><section class="session-panel rail-border-strong" id="ticket-session" aria-label="Session">.*role="log" aria-label="Session".*<\/section><\/div><\/main>$/,
    );
    expect(markup.match(/aria-label="Session"/g)).toHaveLength(2);
  });

  it('should show the images window in the left column before the description when the ticket has images', () => {
    const images = [{ name: 'a.png', url: '/api/projects/o/n/tickets/56/images/a.png' }];

    const markup = render(loaded(), 56, images);

    expect(markup).toMatch(
      /<div class="tp-left">(?:(?!<section class="session-panel).)*<section class="image-window"[^>]*>.*<\/section><section class="ticket-body"/,
    );
  });

  it('should show no images window when the ticket has no images', () => {
    expect(render(loaded())).not.toContain('image-window');
  });

  it('should show no description toggle when no round is up', () => {
    const markup = render(loaded());

    expect(markup).not.toContain('aria-controls="ticket-description"');
  });

  it('should show the back link, the title, the status chip, Open on GitHub and the parent in that order in the top bar when the ticket has a parent', () => {
    const markup = render(
      loaded({
        parent: { href: '#/projects/o%2Fn/tickets/20', numberLabel: '#20', title: 'Upload polish' },
      }),
    );

    expect(markup).toMatch(
      /<header class="tp-bar"><div class="tp-id"><a class="back"[^>]*>.*Back to the board<\/a><h1>.*#56.*Retry a failed upload<\/h1><div class="tp-chips"><span class="chip neutral">.*Ready<\/span><a class="ext"[^>]*>Open on GitHub<\/a><span class="dot" aria-hidden="true">·<\/span><span><span class="label">Parent<\/span><a href="#\/projects\/o%2Fn\/tickets\/20">.*#20.* Upload polish<\/a><\/span><\/div><\/div>/,
    );
  });

  it('should leave out the dot and the parent when the ticket has no parent', () => {
    const markup = render(loaded());

    expect(markup).not.toContain('Parent');
    expect(markup).not.toContain('class="dot"');
  });

  it('should show the status chip, then the Waiting chip, then Open on GitHub when the ticket is marked waiting', () => {
    const markup = render(
      loaded({
        numberLabel: '#407',
        title: 'Add a dark mode switch to the rail',
        status: 'in-progress',
        waiting: true,
        marker: 'waiting',
        statusLabel: 'In progress',
        statusMark: { shape: '●', tone: 'flow', pulses: false },
      }),
      407,
    );

    expect(markup).toMatch(
      /<div class="tp-chips"><span class="chip flow">.*?In progress<\/span><span class="chip hitl">.*?Waiting<\/span><a class="ext"[^>]*>Open on GitHub<\/a>/,
    );
  });

  it('should end the top bar with the session toggle in the run actions slot when the ticket is loaded', () => {
    const markup = render(loaded());

    expect(markup).toMatch(
      /<\/div><div class="tp-actions"><button[^>]*>Hide session<\/button><\/div><\/header><div class="tp-cols">/,
    );
  });

  it.each([
    { status: 'backlog', shown: true },
    { status: 'plan', shown: false },
    { status: 'ready', shown: false },
  ] as const)(
    'should show Move to plan in the header actions only when the status is backlog ($status)',
    ({ status, shown }) => {
      const markup = render(
        loaded({ status, statusLabel: 'Backlog', runSkill: 'create-ticket' }),
        212,
      );

      expect(markup.includes('aria-label="Move to plan"')).toBe(shown);
      if (shown) {
        expect(markup).toMatch(
          /<div class="tp-actions">(?:(?!<\/div>).)*<section class="move-to-plan" aria-label="Move to plan">.*<\/section>(?:<button|<\/div><\/header>)/,
        );
        expect(markup).not.toMatch(
          /<div class="tp-left">(?:(?!<div class="tp-cols">).)*aria-label="Move to plan"/,
        );
      }
    },
  );

  it('should show no plain Pull requests row when the ticket has no pull request', () => {
    const markup = render(loaded());

    expect(markup).not.toContain('Pull requests');
  });

  it('should show the review panel and no plain Pull requests row when the ticket has a pull request', () => {
    const markup = render(
      loaded({
        status: 'in-review',
        reviewPanel: {
          kind: 'shown',
          state: 'open',
          heading: { tone: 'hitl', glyph: '●', text: 'Review the PR' },
          pullRequests: [{ label: 'PR #9', url: 'https://github.com/o/n/pull/9', chips: [] }],
        },
      }),
    );

    expect(markup).toContain('Review the PR');
    expect(markup).not.toContain('<dl class="facts"><dt class="label">Pull requests');
  });

  it('should show no Open page line above the questionnaire', () => {
    expect(render(loaded())).not.toContain('Open page:');
  });

  it('should show the message, the reload hint, Retry and the detail in that order when the ticket read failed', () => {
    const markup = render({
      kind: 'failed',
      message: "Couldn't load #56. Can't reach aisf.",
      detail: 'Failed to fetch',
    });

    expect(markup).toMatch(
      /Couldn&#x27;t load #56.*<p class="sm">Loads again on the next change, or on Retry\.<\/p><button[^>]*>Retry<\/button><p class="sm mono">Failed to fetch<\/p>/,
    );
  });

  it('should open with the session shown and a Hide session button when the page has just mounted', () => {
    const markup = render(loaded());

    expect(markup).toMatch(/<section[^>]*class="session-panel[^"]*"[^>]*id="ticket-session"/);
    expect(markup).not.toMatch(/<section[^>]*id="ticket-session"[^>]*hidden/);
    expect(markup).toContain(
      '<button class="tp-toggle" type="button" aria-expanded="true" aria-controls="ticket-session">Hide session</button>',
    );
  });
});
