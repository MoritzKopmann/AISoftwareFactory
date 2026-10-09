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
});
