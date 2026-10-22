import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SessionToggle } from './session-toggle.js';

const ignore = () => undefined;

describe('SessionToggle', () => {
  it('should render an expanded button that controls the session panel when the session is shown', () => {
    const markup = renderToStaticMarkup(
      <SessionToggle toggle={{ label: 'Hide session', expanded: true }} onToggle={ignore} />,
    );

    expect(markup).toBe(
      '<button class="tp-toggle" type="button" aria-expanded="true" aria-controls="ticket-session">Hide session</button>',
    );
  });

  it('should render a collapsed Show session button when the session is hidden', () => {
    const markup = renderToStaticMarkup(
      <SessionToggle toggle={{ label: 'Show session', expanded: false }} onToggle={ignore} />,
    );

    expect(markup).toContain('aria-expanded="false"');
    expect(markup).toContain('>Show session</button>');
  });
});
