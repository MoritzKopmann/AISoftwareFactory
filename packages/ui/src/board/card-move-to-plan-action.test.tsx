import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CardMoveToPlanAction, CardMoveToPlanView } from './card-move-to-plan-action.js';

const ignoreMove = () => undefined;

describe('CardMoveToPlanView', () => {
  it('should render nothing when the action is hidden', () => {
    const markup = renderToStaticMarkup(
      <CardMoveToPlanView description={{ kind: 'hidden' }} onMove={ignoreMove} />,
    );

    expect(markup).toBe('');
  });

  it('should render a plain, pressable Move to plan button when idle', () => {
    const markup = renderToStaticMarkup(
      <CardMoveToPlanView description={{ kind: 'idle' }} onMove={ignoreMove} />,
    );

    expect(markup).toMatch(/<button[^>]*class="btn"[^>]*>Move to plan<\/button>/);
    expect(markup).not.toContain('primary');
    expect(markup).not.toContain('aria-disabled');
  });

  it('should keep the busy button focusable and show Moving… with an accent dot when sending', () => {
    const markup = renderToStaticMarkup(
      <CardMoveToPlanView description={{ kind: 'sending' }} onMove={ignoreMove} />,
    );

    expect(markup).toContain('aria-disabled="true"');
    expect(markup).not.toMatch(/\sdisabled=""/);
    expect(markup).toMatch(/aria-hidden="true">●<\/span>Moving…/);
  });

  it('should replace the button with a status line when done', () => {
    const markup = renderToStaticMarkup(
      <CardMoveToPlanView description={{ kind: 'done' }} onMove={ignoreMove} />,
    );

    expect(markup).not.toContain('<button');
    expect(markup).toMatch(/role="status"[^>]*>.*Moved to plan\. Shows on next refresh\./);
    expect(markup).toMatch(/aria-hidden="true">✓/);
  });

  it('should show the message in an alert beside a pressable button when failed', () => {
    const markup = renderToStaticMarkup(
      <CardMoveToPlanView
        description={{ kind: 'failed', message: 'Ticket #212 is no longer in backlog.' }}
        onMove={ignoreMove}
      />,
    );

    expect(markup).toMatch(/<button[^>]*>Move to plan<\/button>/);
    expect(markup).not.toContain('aria-disabled');
    expect(markup).toMatch(/role="alert"[^>]*>.*Ticket #212 is no longer in backlog\./);
    expect(markup).toMatch(/aria-hidden="true">■/);
  });
});

describe('CardMoveToPlanAction', () => {
  it('should start idle with a Move to plan button', () => {
    const markup = renderToStaticMarkup(<CardMoveToPlanAction projectId="o/n" number={212} />);

    expect(markup).toMatch(/<button[^>]*>Move to plan<\/button>/);
  });
});
