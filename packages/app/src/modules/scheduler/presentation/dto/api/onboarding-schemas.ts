import { z } from 'zod';

export const onboardingResponseSchema = z.object({
  ticketNumber: z.number(),
});
export type OnboardingResponse = z.infer<typeof onboardingResponseSchema>;
