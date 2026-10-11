import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { LiveUpdates } from '../../src/live/live-updates.js';
import { TicketPageView } from '../../src/tickets/ticket-page.js';

const ignore = () => undefined;
const liveUpdates: LiveUpdates = { listen: () => ignore, connection: () => 'open' };

describe('TicketPageView', () => {
  it('should end with the collapsed description after the run log when the ticket is loaded', () => {
    const markup = renderToStaticMarkup(
      <TicketPageView
        liveUpdates={liveUpdates}
        projectId="o/n"
        number={56}
        description={{
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
          pullRequests: [],
        }}
        onRetry={ignore}
      />,
    );
    expect(markup).toMatch(
      /<details class="row runlog"><summary.*<\/summary><\/details><details class="row ticket-body"><summary.*<\/summary>.*<\/details><\/main>$/,
    );
  });

  it('should show the status chip, then the Waiting chip, then Open on GitHub when the ticket is marked waiting', () => {
    const markup = renderToStaticMarkup(
      <TicketPageView
        liveUpdates={liveUpdates}
        projectId="o/n"
        number={407}
        description={{
          kind: 'loaded',
          numberLabel: '#407',
          title: 'Add a dark mode switch to the rail',
          status: 'in-progress',
          waiting: true,
          stuck: false,
          marker: 'waiting',
          statusLabel: 'In progress',
          statusMark: { shape: '●', tone: 'flow', pulses: false },
          url: 'https://github.com/o/n/issues/407',
          body: '',
          runSkill: 'implement-ticket',
          pullRequests: [],
        }}
        onRetry={ignore}
      />,
    );
    expect(markup).toMatch(
      /<div class="inline"><span class="chip flow">.*?In progress<\/span><span class="chip hitl">.*?Waiting<\/span><a class="ext"[^>]*>Open on GitHub<\/a><\/div>/,
    );
  });

  it('should show the message, the reload hint, Retry and the detail in that order when the ticket read failed', () => {
    const markup = renderToStaticMarkup(
      <TicketPageView
        liveUpdates={liveUpdates}
        projectId="o/n"
        number={56}
        description={{
          kind: 'failed',
          message: "Couldn't load #56. Can't reach aisf.",
          detail: 'Failed to fetch',
        }}
        onRetry={ignore}
      />,
    );
    expect(markup).toMatch(
      /Couldn&#x27;t load #56.*<p class="sm">Loads again on the next change, or on Retry\.<\/p><button[^>]*>Retry<\/button><p class="sm mono">Failed to fetch<\/p>/,
    );
  });
});
