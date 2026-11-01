import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { HeldStatus } from './held-status.js';

describe('HeldStatus', () => {
  it('should name the answer when no noun is given', () => {
    expect(renderToStaticMarkup(<HeldStatus />)).toContain('Your answer is held.');
  });

  it('should name the given noun when one is passed', () => {
    const markup = renderToStaticMarkup(<HeldStatus noun="message" heldUntilLabel="15:00" />);

    expect(markup).toContain('Your message is held. It goes out at <strong>15:00</strong>.');
  });
});
