import type { TicketImagesResponse } from '@aisf/app/api-schemas/images-schemas.js';
import { isRequestFailure } from '../shared/is-request-failure.js';

export type TicketImage = TicketImagesResponse['images'][number];

/** A failed read holds no images, like an empty list: no window. */
export async function fetchTicketImages(
  projectId: string,
  number: number,
  request: (url: string) => Promise<Response>,
): Promise<readonly TicketImage[]> {
  try {
    const response = await request(`/api/projects/${projectId}/tickets/${number}/images`);
    if (!response.ok) {
      return [];
    }
    return ((await response.json()) as TicketImagesResponse).images;
  } catch (error) {
    if (!isRequestFailure(error)) throw error;
    return [];
  }
}
