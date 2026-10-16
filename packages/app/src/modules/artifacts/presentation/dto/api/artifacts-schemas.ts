import { z } from 'zod';

export const ticketArtifactSchema = z.object({
  artifactId: z.string(),
  title: z.string(),
  url: z.string(),
  status: z.enum(['open', 'busy', 'closed']),
});

export const ticketArtifactsResponseSchema = z.object({
  artifacts: z.array(ticketArtifactSchema),
});
export type TicketArtifactsResponse = z.infer<typeof ticketArtifactsResponseSchema>;

export const pageStatusResponseSchema = z.object({
  status: z.enum(['open', 'busy', 'closed']),
  version: z.number().int(),
});
export type PageStatusResponse = z.infer<typeof pageStatusResponseSchema>;
