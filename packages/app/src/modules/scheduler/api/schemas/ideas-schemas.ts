import { z } from 'zod';

export const ideaRequestSchema = z.object({
  title: z.string().trim().min(1).max(10_000),
});
export type IdeaRequest = z.infer<typeof ideaRequestSchema>;

export const ideaResponseSchema = z.object({
  ticketNumber: z.number(),
});
export type IdeaResponse = z.infer<typeof ideaResponseSchema>;

export const ideaRunNotStartedResponseSchema = z.object({
  message: z.string(),
  ticketNumber: z.number(),
});
export type IdeaRunNotStartedResponse = z.infer<typeof ideaRunNotStartedResponseSchema>;
