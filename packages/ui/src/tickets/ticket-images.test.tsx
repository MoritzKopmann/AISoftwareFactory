import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { TicketImages } from './ticket-images.js';

describe('TicketImages', () => {
  it('should show the image window and no viewer when no image is open', () => {
    const images = [{ name: 'a.png', url: '/api/projects/p/tickets/7/images/a.png' }];

    const markup = renderToStaticMarkup(<TicketImages images={images} />);

    expect(markup).toContain('class="image-window"');
    expect(markup).not.toContain('<dialog');
  });
});
