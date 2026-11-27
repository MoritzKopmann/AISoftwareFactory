import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { TicketCardDescription } from './describe-ticket-card.js';
import type { TypeChip } from './describe-type-chips.js';
import { TicketCard } from './ticket-card.js';

function buildCard(overrides: Partial<TicketCardDescription> = {}): TicketCardDescription {
  return {
    href: '#/projects/o/n/tickets/1',
    number: 1,
    numberLabel: '#1',
    title: 'A ticket',
    backlog: false,
    hitl: false,
    typeChips: [],
    blockerLabels: [],
    conflictLabels: [],
    pullRequestChips: [],
    ...overrides,
  };
}

const uiChip: TypeChip = { type: 'ui', label: 'UI' };
const spikeChip: TypeChip = { type: 'spike', label: 'SPIKE' };
const skillChip: TypeChip = { type: 'skill', label: 'SKILL' };
const bugChip: TypeChip = { type: 'bug', label: 'BUG' };

describe('TicketCard', () => {
  it('should show a SPIKE chip and no HITL chip when the ticket is a spike without hitl', () => {
    const markup = renderToStaticMarkup(
      <TicketCard {...buildCard({ typeChips: [spikeChip] })} projectId="o/n" />,
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
      <TicketCard {...buildCard({ hitl: true, typeChips: [spikeChip] })} projectId="o/n" />,
    );

    expect(markup).toContain(
      '<span class="chip hitl">HITL</span><span class="chip spike">SPIKE</span>',
    );
  });

  it('should show the UI chip in the meta row when the ticket is ui and has no other flag', () => {
    const markup = renderToStaticMarkup(
      <TicketCard {...buildCard({ typeChips: [uiChip] })} projectId="o/n" />,
    );

    expect(markup).toContain('<span class="meta"><span class="chip ui">UI</span></span>');
  });

  it('should show no UI chip when the ticket is not ui', () => {
    const markup = renderToStaticMarkup(<TicketCard {...buildCard()} projectId="o/n" />);

    expect(markup).not.toContain('chip ui');
  });

  it('should show the HITL chip directly followed by the UI chip when the ticket is a hitl ui ticket', () => {
    const markup = renderToStaticMarkup(
      <TicketCard {...buildCard({ hitl: true, typeChips: [uiChip] })} projectId="o/n" />,
    );

    expect(markup).toContain('<span class="chip hitl">HITL</span><span class="chip ui">UI</span>');
  });

  it('should show the SKILL chip in the meta row when the ticket is skill and has no other flag', () => {
    const markup = renderToStaticMarkup(
      <TicketCard {...buildCard({ typeChips: [skillChip] })} projectId="o/n" />,
    );

    expect(markup).toContain('<span class="meta"><span class="chip skill">SKILL</span></span>');
  });

  it('should show the chips in the order HITL, SPIKE, SKILL when the ticket has all three', () => {
    const markup = renderToStaticMarkup(
      <TicketCard
        {...buildCard({ hitl: true, typeChips: [spikeChip, skillChip] })}
        projectId="o/n"
      />,
    );

    expect(markup).toContain(
      '<span class="chip hitl">HITL</span><span class="chip spike">SPIKE</span><span class="chip skill">SKILL</span>',
    );
  });

  it('should show the BUG chip in the meta row when the ticket is bug and has no other flag', () => {
    const markup = renderToStaticMarkup(
      <TicketCard {...buildCard({ typeChips: [bugChip] })} projectId="o/n" />,
    );

    expect(markup).toContain('<span class="meta"><span class="chip bug">BUG</span></span>');
  });

  it('should show no meta row when the ticket has no type chip and no other meta item', () => {
    const markup = renderToStaticMarkup(<TicketCard {...buildCard()} projectId="o/n" />);

    expect(markup).not.toContain('class="meta"');
  });

  it('should show no SKILL chip when the ticket is not skill', () => {
    const markup = renderToStaticMarkup(<TicketCard {...buildCard()} projectId="o/n" />);

    expect(markup).not.toContain('chip skill');
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
