import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { NeedsYouList } from '../../src/board/needs-you.js';

describe('NeedsYouList', () => {
  it('should render a link per entry when the list is shown', () => {
    const markup = renderToStaticMarkup(
      <NeedsYouList
        description={{
          kind: 'list',
          entries: [
            {
              ticketNumber: 7,
              numberLabel: '#7',
              title: 'Export',
              actionText: 'Answer',
              href: '#/projects/o/n/tickets/7',
            },
          ],
        }}
        onRetry={() => undefined}
      />,
    );
    expect(markup).toContain('href="#/projects/o/n/tickets/7"');
    expect(markup).toContain('Export');
  });

  it('should render Retry when the read failed', () => {
    const markup = renderToStaticMarkup(
      <NeedsYouList description={{ kind: 'failed', message: 'x' }} onRetry={() => undefined} />,
    );
    expect(markup).toMatch(/<button[^>]*>Retry<\/button>/);
  });

  it('should render the empty message when nothing waits', () => {
    const markup = renderToStaticMarkup(
      <NeedsYouList
        description={{ kind: 'empty', message: 'Nothing is waiting for you' }}
        onRetry={() => undefined}
      />,
    );
    expect(markup).toContain('Nothing is waiting for you');
  });
});
