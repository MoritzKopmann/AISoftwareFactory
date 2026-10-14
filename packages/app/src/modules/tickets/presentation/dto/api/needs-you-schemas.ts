import { z } from 'zod';

export const needsYouRowSchema = z.object({
  ticketNumber: z.number(),
  title: z.string(),
  action: z.enum([
    'answer-round',
    'answer-question',
    'allow-permission',
    'decide-stuck',
    'review-pull-request',
  ]),
  since: z.string(),
});
export type NeedsYouRowResponse = z.infer<typeof needsYouRowSchema>;

export const needsYouResponseSchema = z.object({ rows: z.array(needsYouRowSchema) });
export type NeedsYouResponse = z.infer<typeof needsYouResponseSchema>;
