import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { NeedsYouList } from './needs-you.js';

describe('NeedsYouList', () => {
  it('should render a link per entry with its wait and action when the list is shown', () => {
    const markup = renderToStaticMarkup(
      <NeedsYouList
        description={{
          kind: 'list',
          count: 1,
          entries: [
            {
              ticketNumber: 7,
              numberLabel: '#7',
              title: 'Export',
              shape: '●',
              tone: 'hitl',
              actionText: 'Answer a round',
              waitLabel: '48 min',
              href: '#/projects/o/n/tickets/7',
            },
          ],
        }}
        onRetry={() => undefined}
      />,
    );
    expect(markup).toContain('href="#/projects/o/n/tickets/7"');
    expect(markup).toContain('Export');
    expect(markup).toContain('48 min');
    expect(markup).toContain('Answer a round');
  });

  it('should show the row count in the head when the list is shown', () => {
    const markup = renderToStaticMarkup(
      <NeedsYouList
        description={{ kind: 'list', count: 5, entries: [] }}
        onRetry={() => undefined}
      />,
    );
    expect(markup).toMatch(/Needs you<\/h2><span[^>]*>5<\/span>/);
  });

  it('should render Retry, the reload hint and the detail when the read failed', () => {
    const markup = renderToStaticMarkup(
      <NeedsYouList
        description={{
          kind: 'failed',
          message: "Couldn't load what needs you.",
          detail: 'GET /needs-you · 502 Bad Gateway',
        }}
        onRetry={() => undefined}
      />,
    );
    expect(markup).toMatch(/<button[^>]*>Retry<\/button>/);
    expect(markup).toContain('Loads again on the next change, or on Retry.');
    expect(markup).toContain('GET /needs-you · 502 Bad Gateway');
  });

  it('should render the empty message and a zero count when nothing waits', () => {
    const markup = renderToStaticMarkup(
      <NeedsYouList
        description={{ kind: 'empty', count: 0, message: 'Nothing is waiting for you' }}
        onRetry={() => undefined}
      />,
    );
    expect(markup).toContain('Nothing is waiting for you');
    expect(markup).toMatch(/Needs you<\/h2><span[^>]*>0<\/span>/);
  });

  it('should mark the section busy when the first read has not answered', () => {
    const markup = renderToStaticMarkup(
      <NeedsYouList description={{ kind: 'loading' }} onRetry={() => undefined} />,
    );
    expect(markup).toMatch(/<section[^>]*aria-busy="true"/);
  });
});
