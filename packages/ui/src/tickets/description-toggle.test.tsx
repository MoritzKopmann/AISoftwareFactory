import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DescriptionToggle } from './description-toggle.js';

const ignore = () => undefined;

describe('DescriptionToggle', () => {
  it('should render nothing when the toggle is hidden', () => {
    const markup = renderToStaticMarkup(
      <DescriptionToggle toggle={{ kind: 'hidden' }} onToggle={ignore} />,
    );

    expect(markup).toBe('');
  });

  it('should render a button that is collapsed and controls the description when the toggle is closed', () => {
    const markup = renderToStaticMarkup(
      <DescriptionToggle
        toggle={{ kind: 'shown', label: 'Show description', expanded: false }}
        onToggle={ignore}
      />,
    );

    expect(markup).toBe(
      '<button class="tp-toggle" type="button" aria-expanded="false" aria-controls="ticket-description">Show description</button>',
    );
  });

  it('should render the Hide description label and aria-expanded true when the toggle is open', () => {
    const markup = renderToStaticMarkup(
      <DescriptionToggle
        toggle={{ kind: 'shown', label: 'Hide description', expanded: true }}
        onToggle={ignore}
      />,
    );

    expect(markup).toContain('aria-expanded="true"');
    expect(markup).toContain('>Hide description</button>');
  });
});
