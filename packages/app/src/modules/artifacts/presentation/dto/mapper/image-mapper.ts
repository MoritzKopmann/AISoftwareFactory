import type { TicketImagesResponse } from '../api/images-schemas.js';

export function toTicketImagesResponse(
  projectId: string,
  ticketNumber: number,
  imageNames: ReadonlyArray<string>,
): TicketImagesResponse {
  return {
    images: imageNames.map((imageName) => ({
      name: imageName,
      url: `/api/projects/${projectId}/tickets/${ticketNumber}/images/${encodeURIComponent(imageName)}`,
    })),
  };
}
