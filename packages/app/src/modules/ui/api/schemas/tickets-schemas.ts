import { z } from 'zod';

export const ticketNumberParameterSchema = z
  .string()
  .regex(/^[1-9]\d*$/, 'The ticket number must be a positive integer')
  .transform(Number)
  .refine(Number.isSafeInteger, 'The ticket number is too large');

export const ticketStatusSchema = z.enum([
  'idea',
  'backlog',
  'plan',
  'planned',
  'ready',
  'in-progress',
  'in-review',
  'stuck',
  'conflict',
  'closed',
]);
export type TicketStatusResponse = z.infer<typeof ticketStatusSchema>;

export const ticketResponseSchema = z.object({
  number: z.number(),
  title: z.string(),
  url: z.string(),
  status: ticketStatusSchema,
  conflictingStatuses: z.array(ticketStatusSchema),
  hitl: z.boolean(),
  parent: z.object({ number: z.number(), title: z.string() }).optional(),
  subIssueNumbers: z.array(z.number()),
  blockedBy: z.array(z.object({ repository: z.string(), number: z.number(), open: z.boolean() })),
  closingPullRequests: z.array(
    z.object({ number: z.number(), url: z.string(), state: z.string() }),
  ),
  updatedAt: z.string(),
});
export type TicketResponse = z.infer<typeof ticketResponseSchema>;

export const syncStatusResponseSchema = z.discriminatedUnion('state', [
  z.object({ state: z.literal('pending') }),
  z.object({
    state: z.literal('ok'),
    checkedAt: z.string(),
    snapshotTakenAt: z.string(),
  }),
  z.object({
    state: z.literal('failed'),
    cause: z.enum(['auth', 'rate-limited', 'unavailable', 'unexpected']),
    message: z.string(),
    failedAt: z.string(),
    retryAt: z.string().optional(),
    snapshotTakenAt: z.string().optional(),
  }),
]);
export type SyncStatusResponse = z.infer<typeof syncStatusResponseSchema>;

export const boardRowResponseSchema = z.object({
  key: ticketStatusSchema,
  tickets: z.array(ticketResponseSchema),
  totalCount: z.number(),
});
export type BoardRowResponse = z.infer<typeof boardRowResponseSchema>;

export const projectBoardResponseSchema = z.object({
  projectId: z.string(),
  sync: syncStatusResponseSchema,
  board: z.object({ rows: z.array(boardRowResponseSchema) }).optional(),
});
export type ProjectBoardResponse = z.infer<typeof projectBoardResponseSchema>;

export const projectTicketResponseSchema = z.object({
  projectId: z.string(),
  sync: syncStatusResponseSchema,
  ticket: ticketResponseSchema.optional(),
});
export type ProjectTicketResponse = z.infer<typeof projectTicketResponseSchema>;
