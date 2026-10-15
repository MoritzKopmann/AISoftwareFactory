import { z } from 'zod';

export const findingIdParameterSchema = z
  .string()
  .regex(/^[1-9]\d*$/, 'The finding id must be a positive integer')
  .transform(Number)
  .refine(Number.isSafeInteger, 'The finding id is too large');

export const findingResponseSchema = z.object({
  id: z.number(),
  projectId: z.string(),
  ticketNumber: z.number(),
  runId: z.string(),
  kind: z.enum(['bug', 'gap']),
  location: z.string(),
  summary: z.string(),
  state: z.enum(['open', 'creating', 'ticketed', 'dismissed']),
  createdTicketNumber: z.number().optional(),
  reportedAt: z.string(),
  resolvedAt: z.string().optional(),
});
export type FindingResponse = z.infer<typeof findingResponseSchema>;

export const findingsResponseSchema = z.object({
  findings: z.array(findingResponseSchema),
});
export type FindingsResponse = z.infer<typeof findingsResponseSchema>;
