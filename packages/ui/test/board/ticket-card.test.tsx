import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { TicketCardDescription } from '../../src/board/describe-ticket-card.js';
import { TicketCard } from '../../src/board/ticket-card.js';

function buildCard(overrides: Partial<TicketCardDescription> = {}): TicketCardDescription {
  return {
    href: '#/projects/o/n/tickets/1',
    numberLabel: '#1',
    title: 'A ticket',
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
    const markup = renderToStaticMarkup(<TicketCard {...buildCard({ spike: true })} />);

    expect(markup).toContain('<span class="chip spike">SPIKE</span>');
    expect(markup).not.toContain('HITL');
  });

  it('should show no SPIKE chip when the ticket is not a spike', () => {
    const markup = renderToStaticMarkup(<TicketCard {...buildCard()} />);

    expect(markup).not.toContain('SPIKE');
  });

  it('should show the HITL chip directly followed by the SPIKE chip when the ticket is a hitl spike', () => {
    const markup = renderToStaticMarkup(<TicketCard {...buildCard({ hitl: true, spike: true })} />);

    expect(markup).toContain(
      '<span class="chip hitl">HITL</span><span class="chip spike">SPIKE</span>',
    );
  });
});
