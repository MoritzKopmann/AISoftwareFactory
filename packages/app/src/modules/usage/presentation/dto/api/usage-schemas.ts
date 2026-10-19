import { z } from 'zod';

const usageWindowSchema = z.object({
  utilizationPercent: z.number().min(0).max(100),
  resetsAt: z.string(),
});

export const usageResponseSchema = z.object({
  pausedUntil: z.string().nullable(),
  observedAt: z.string().nullable(),
  fiveHour: usageWindowSchema.nullable(),
  sevenDay: usageWindowSchema.nullable(),
});
export type UsageResponse = z.infer<typeof usageResponseSchema>;
