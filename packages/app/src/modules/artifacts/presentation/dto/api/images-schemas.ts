import { z } from 'zod';

export const ticketImageSchema = z.object({
  name: z.string(),
  url: z.string(),
});

export const ticketImagesResponseSchema = z.object({
  images: z.array(ticketImageSchema),
});
export type TicketImagesResponse = z.infer<typeof ticketImagesResponseSchema>;
