import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MoveToPlanAction } from './move-to-plan-action.js';

const ignoreMove = () => undefined;

describe('MoveToPlanAction', () => {
  it('should render nothing when the action is hidden', () => {
    expect(
      renderToStaticMarkup(
        <MoveToPlanAction description={{ kind: 'hidden' }} onMove={ignoreMove} />,
      ),
    ).toBe('');
  });

  it('should render a pressable primary Move to plan in a labelled section when idle', () => {
    const markup = renderToStaticMarkup(
      <MoveToPlanAction description={{ kind: 'idle' }} onMove={ignoreMove} />,
    );
    expect(markup).toContain('aria-label="Move to plan"');
    expect(markup).toMatch(/<button[^>]*class="btn primary"[^>]*>Move to plan<\/button>/);
    expect(markup).not.toContain('aria-disabled');
    expect(markup).not.toContain('Sets the ticket');
  });

  it('should keep the busy button focusable and show Moving to plan… when sending', () => {
    const markup = renderToStaticMarkup(
      <MoveToPlanAction description={{ kind: 'sending' }} onMove={ignoreMove} />,
    );
    expect(markup).toContain('aria-disabled="true"');
    expect(markup).not.toMatch(/\sdisabled=""/);
    expect(markup).toContain('Moving to plan…');
    expect(markup).toContain('●');
  });

  it('should replace the button and reason with a status line when done', () => {
    const markup = renderToStaticMarkup(
      <MoveToPlanAction description={{ kind: 'done' }} onMove={ignoreMove} />,
    );
    expect(markup).not.toContain('<button');
    expect(markup).not.toContain('class="reason"');
    expect(markup).toMatch(
      /role="status"[^>]*>.*Moved to plan\. The status shows plan after the next refresh\./,
    );
    expect(markup).toContain('✓');
  });

  it('should announce the message through an alert beside a pressable button when failed', () => {
    const markup = renderToStaticMarkup(
      <MoveToPlanAction
        description={{ kind: 'failed', message: 'Ticket #212 is no longer in backlog.' }}
        onMove={ignoreMove}
      />,
    );
    expect(markup).not.toContain('aria-disabled');
    expect(markup).toMatch(/<button[^>]*>Move to plan<\/button>/);
    expect(markup).toMatch(/role="alert"[^>]*>.*Ticket #212 is no longer in backlog\./);
    expect(markup).toContain('■');
  });

  it('should hide the decorative icons from assistive technology', () => {
    const markup = renderToStaticMarkup(
      <MoveToPlanAction description={{ kind: 'failed', message: 'x' }} onMove={ignoreMove} />,
    );
    expect(markup).toMatch(/aria-hidden="true">■/);
  });
});
