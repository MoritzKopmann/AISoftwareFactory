import { z } from 'zod';

export const ticketStatusSchema = z.enum([
  'idea',
  'backlog',
  'plan',
  'planned',
  'ready',
  'in-progress',
  'waiting',
  'in-review',
  'stuck',
  'conflict',
  'closed',
]);
export type TicketStatusResponse = z.infer<typeof ticketStatusSchema>;

export const ticketTypeSchema = z.enum(['bug', 'enhancement', 'task', 'spike', 'ui']);
export type TicketTypeResponse = z.infer<typeof ticketTypeSchema>;

export const ticketResponseSchema = z.object({
  number: z.number(),
  title: z.string(),
  url: z.string(),
  body: z.string(),
  status: ticketStatusSchema,
  conflictingStatuses: z.array(ticketStatusSchema),
  hitl: z.boolean(),
  types: z.array(ticketTypeSchema),
  parent: z.object({ number: z.number(), title: z.string() }).optional(),
  subIssueNumbers: z.array(z.number()),
  blockedBy: z.array(z.object({ repository: z.string(), number: z.number(), open: z.boolean() })),
  closingPullRequests: z.array(
    z.object({
      number: z.number(),
      url: z.string(),
      state: z.string(),
      approved: z.boolean(),
      checks: z.enum(['passing', 'failing', 'pending', 'none']),
      mergeable: z.enum(['mergeable', 'conflicting', 'unknown']),
      canBeRebased: z.boolean(),
      headCommit: z.string(),
    }),
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
  runningTicketNumbers: z.array(z.number()),
});
export type ProjectBoardResponse = z.infer<typeof projectBoardResponseSchema>;

export const projectTicketResponseSchema = z.object({
  projectId: z.string(),
  sync: syncStatusResponseSchema,
  ticket: ticketResponseSchema.optional(),
});
export type ProjectTicketResponse = z.infer<typeof projectTicketResponseSchema>;
