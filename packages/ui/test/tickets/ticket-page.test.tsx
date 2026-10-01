import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { TicketPageView } from '../../src/tickets/ticket-page.js';

const ignore = () => undefined;

describe('TicketPageView', () => {
  it('should end with the collapsed session log when the ticket is loaded', () => {
    const markup = renderToStaticMarkup(
      <TicketPageView
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
          pullRequests: [],
        }}
        onRetry={ignore}
        onTicketStale={ignore}
      />,
    );
    expect(markup).toMatch(
      /<details class="row sessionlog"><summary.*<\/summary><\/details><\/main>$/,
    );
  });
});
