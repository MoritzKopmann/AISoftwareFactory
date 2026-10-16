import { z } from 'zod';

export const pageEventBodySchema = z.object({
  kind: z.enum(['submit', 'confirm', 'reopen']),
  round: z.number().int().min(1),
  payload: z.unknown().refine((value) => value !== undefined, 'payload is required'),
});

export type PageEventBody = z.infer<typeof pageEventBodySchema>;
