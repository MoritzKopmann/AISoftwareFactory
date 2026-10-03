import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { TicketBodySection } from '../../src/tickets/ticket-body-section.js';

describe('TicketBodySection', () => {
  it('should render a collapsed details with the Description label and toggle texts when rendered', () => {
    const markup = renderToStaticMarkup(<TicketBodySection body="Hello" />);
    expect(markup).toMatch(/^<details class="row ticket-body">/);
    expect(markup).not.toContain(' open');
    expect(markup).toContain('>Description<');
    expect(markup).toContain('Show description');
    expect(markup).toContain('Hide description');
    expect(markup).not.toContain('class="n"');
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
