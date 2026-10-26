import type { TicketImagesResponse } from '@aisf/app/api-schemas/images-schemas.js';
import { describe, expect, it } from 'vitest';
import { fetchTicketImages } from './fetch-ticket-images.js';

const response: TicketImagesResponse = {
  images: [
    { name: 'before.png', url: '/images/before.png' },
    { name: 'after.png', url: '/images/after.png' },
  ],
};

function answerWith(status: number, body: unknown = response): () => Promise<Response> {
  return () => Promise.resolve(new Response(JSON.stringify(body), { status }));
}

describe('fetchTicketImages', () => {
  it("should ask for the ticket's images under the project's owner and name", async () => {
    const requestedUrls: string[] = [];
    await fetchTicketImages('MoritzKopmann/postkarte', 41, (url) => {
      requestedUrls.push(url);
      return answerWith(200)();
    });

    expect(requestedUrls).toEqual(['/api/projects/MoritzKopmann/postkarte/tickets/41/images']);
  });

  it('should hold both names and URLs when the route returns two images', async () => {
    expect(await fetchTicketImages('o/n', 41, answerWith(200))).toEqual(response.images);
  });

  it('should hold no images when the route returns an empty list', async () => {
    expect(await fetchTicketImages('o/n', 41, answerWith(200, { images: [] }))).toEqual([]);
  });

  it('should hold no images when the route answers an error', async () => {
    expect(await fetchTicketImages('o/n', 41, answerWith(500, { message: 'x' }))).toEqual([]);
  });

  it('should hold no images when the request throws', async () => {
    const images = await fetchTicketImages('o/n', 41, () =>
      Promise.reject(new TypeError('offline')),
    );

    expect(images).toEqual([]);
  });
});
