import { z } from 'zod';

export const runAvailabilityResponseSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('absent') }),
  z.object({ kind: z.literal('disabled'), reason: z.string() }),
  z.object({ kind: z.literal('available') }),
]);
export type RunAvailabilityResponse = z.infer<typeof runAvailabilityResponseSchema>;

export const runStepResponseSchema = z.object({
  at: z.string(),
  summary: z.string(),
});
export type RunStepResponse = z.infer<typeof runStepResponseSchema>;

export const runEndingResponseSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('escalated'),
    escalation: z.enum(['red', 'spec', 'denied']),
    reason: z.string(),
  }),
  z.object({
    kind: z.literal('permission-needed'),
    toolName: z.string(),
    toolInput: z.record(z.string(), z.unknown()),
  }),
  z.object({ kind: z.literal('parked'), blockerNumber: z.number() }),
  z.object({ kind: z.literal('finished') }),
  z.object({ kind: z.literal('stopped') }),
  z.object({ kind: z.literal('crashed'), reason: z.string() }),
  z.object({ kind: z.literal('usage-limit'), reason: z.string() }),
  z.object({ kind: z.literal('app-restarted') }),
]);
export type RunEndingResponse = z.infer<typeof runEndingResponseSchema>;

export const startedRunResponseSchema = z.object({
  id: z.string(),
  startedAt: z.string(),
});
export type StartedRunResponse = z.infer<typeof startedRunResponseSchema>;

export const sessionLogResponseSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('found'),
    entries: z.array(z.object({ summary: z.string() })),
    total: z.number(),
  }),
  z.object({ kind: z.literal('no-session') }),
  z.object({ kind: z.literal('transcript-not-found') }),
]);
export type SessionLogResponse = z.infer<typeof sessionLogResponseSchema>;

export const ticketRunResponseSchema = z.object({
  availability: runAvailabilityResponseSchema,
  activeRun: startedRunResponseSchema.extend({ steps: z.array(runStepResponseSchema) }).optional(),
  lastRun: startedRunResponseSchema
    .extend({ endedAt: z.string(), ending: runEndingResponseSchema })
    .optional(),
});
export type TicketRunResponse = z.infer<typeof ticketRunResponseSchema>;
