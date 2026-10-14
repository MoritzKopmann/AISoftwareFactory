import { z } from 'zod';

export const runLogResponseSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('found'),
    entries: z.array(z.object({ summary: z.string() })),
    total: z.number(),
  }),
  z.object({ kind: z.literal('no-session') }),
  z.object({ kind: z.literal('transcript-not-found') }),
]);
export type RunLogResponse = z.infer<typeof runLogResponseSchema>;
