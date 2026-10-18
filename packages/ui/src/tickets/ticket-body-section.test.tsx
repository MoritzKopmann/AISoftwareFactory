import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { TicketBodySection } from './ticket-body-section.js';

describe('TicketBodySection', () => {
  it('should render a Description panel with a lead and a body when rendered', () => {
    const markup = renderToStaticMarkup(<TicketBodySection body="Hello" />);
    expect(markup).toMatch(
      /^<section class="ticket-body" id="ticket-description" aria-label="Description"><div class="head"><h2 class="lead">Description<\/h2><\/div><div class="body">.*<\/div><\/section>$/,
    );
    expect(markup).not.toContain('<details');
    expect(markup).not.toContain('Show description');
  });

  it('should render the markdown body as elements when the body has text', () => {
    const markup = renderToStaticMarkup(<TicketBodySection body={'## Spec\n\n- one'} />);
    expect(markup).toContain('class="ticket-markdown"');
    expect(markup).toMatch(/<h2[^>]*>Spec<\/h2>/);
    expect(markup).toContain('<li>one</li>');
  });

  it('should show No description when the body is whitespace only', () => {
    const markup = renderToStaticMarkup(<TicketBodySection body={'  \n '} />);
    expect(markup).toContain('No description');
    expect(markup).not.toContain('ticket-markdown');
  });

  it('should render a 65,536-character body whole when the body is that long', () => {
    const body = 'x'.repeat(65_536);
    expect(renderToStaticMarkup(<TicketBodySection body={body} />)).toContain(body);
  });
});
