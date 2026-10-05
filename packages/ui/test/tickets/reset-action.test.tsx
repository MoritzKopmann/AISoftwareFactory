import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ResetAction } from '../../src/tickets/reset-action.js';

const ignoreReset = () => undefined;

describe('ResetAction', () => {
  it('should render nothing when Reset is hidden', () => {
    expect(
      renderToStaticMarkup(<ResetAction description={{ kind: 'hidden' }} onReset={ignoreReset} />),
    ).toBe('');
  });

  it('should render a pressable Reset to ready with its explanation in a labelled section when shown', () => {
    const markup = renderToStaticMarkup(
      <ResetAction description={{ kind: 'shown', resetting: false }} onReset={ignoreReset} />,
    );
    expect(markup).toContain('aria-label="Reset"');
    expect(markup).toMatch(/<button[^>]*>Reset to ready<\/button>/);
    expect(markup).not.toContain('aria-disabled');
    expect(markup).toContain(
      'Puts the ticket back to ready. The worktree and its unsaved work are kept; Run then starts a new session.',
    );
  });

  it('should keep the busy button focusable and announce the reset through a status region when a reset is pending', () => {
    const markup = renderToStaticMarkup(
      <ResetAction
        description={{ kind: 'shown', resetting: true, announcement: 'Resetting #57' }}
        onReset={ignoreReset}
      />,
    );
    expect(markup).toContain('aria-disabled="true"');
    expect(markup).not.toMatch(/\sdisabled=""/);
    expect(markup).toContain('Resetting…');
    expect(markup).toMatch(/role="status"[^>]*>Resetting #57</);
  });

  it('should announce a failed reset through an alert with the message and the status', () => {
    const markup = renderToStaticMarkup(
      <ResetAction
        description={{
          kind: 'shown',
          resetting: false,
          error: { message: "Couldn't reset #57. A run is active on this ticket.", detail: '409' },
        }}
        onReset={ignoreReset}
      />,
    );
    expect(markup).not.toContain('aria-disabled');
    expect(markup).toMatch(
      /role="alert"[\s\S]*Couldn&#x27;t reset #57\. A run is active on this ticket\./,
    );
    expect(markup).toMatch(/<p class="sm mono">409<\/p>/);
  });

  it('should leave out the detail line when the failed reset has no status', () => {
    const markup = renderToStaticMarkup(
      <ResetAction
        description={{
          kind: 'shown',
          resetting: false,
          error: { message: "Couldn't reset #57. Can't reach aisf." },
        }}
        onReset={ignoreReset}
      />,
    );
    expect(markup).toContain('role="alert"');
    expect(markup).not.toContain('sm mono');
  });
});
