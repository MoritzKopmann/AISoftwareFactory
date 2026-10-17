import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { TicketCardDescription } from './describe-ticket-card.js';
import { TicketCard } from './ticket-card.js';

function buildCard(overrides: Partial<TicketCardDescription> = {}): TicketCardDescription {
  return {
    href: '#/projects/o/n/tickets/1',
    number: 1,
    numberLabel: '#1',
    title: 'A ticket',
    backlog: false,
    hitl: false,
    spike: false,
    blockerLabels: [],
    conflictLabels: [],
    pullRequestChips: [],
    ...overrides,
  };
}

describe('TicketCard', () => {
  it('should show a SPIKE chip and no HITL chip when the ticket is a spike without hitl', () => {
    const markup = renderToStaticMarkup(
      <TicketCard {...buildCard({ spike: true })} projectId="o/n" />,
    );

    expect(markup).toContain('<span class="chip spike">SPIKE</span>');
    expect(markup).not.toContain('HITL');
  });

  it('should show no SPIKE chip when the ticket is not a spike', () => {
    const markup = renderToStaticMarkup(<TicketCard {...buildCard()} projectId="o/n" />);

    expect(markup).not.toContain('SPIKE');
  });

  it('should show the HITL chip directly followed by the SPIKE chip when the ticket is a hitl spike', () => {
    const markup = renderToStaticMarkup(
      <TicketCard {...buildCard({ hitl: true, spike: true })} projectId="o/n" />,
    );

    expect(markup).toContain(
      '<span class="chip hitl">HITL</span><span class="chip spike">SPIKE</span>',
    );
  });

  it('should render the whole card as one link without an action when the ticket is not in backlog', () => {
    const markup = renderToStaticMarkup(<TicketCard {...buildCard()} projectId="o/n" />);

    expect(markup).toMatch(/^<a class="card" href="#\/projects\/o\/n\/tickets\/1"/);
    expect(markup).not.toContain('<button');
  });

  it('should render a div card with the title as the link and a Move to plan button when the ticket is in backlog', () => {
    const markup = renderToStaticMarkup(
      <TicketCard {...buildCard({ backlog: true })} projectId="o/n" />,
    );

    expect(markup).toMatch(/^<div class="card/);
    expect(markup).toMatch(/<a[^>]*href="#\/projects\/o\/n\/tickets\/1"[^>]*>.*#1.*A ticket/);
    expect(markup).toMatch(/<button[^>]*>Move to plan<\/button>/);
  });
});
