import { z } from 'zod';
import { domainEventNames } from '../../../../../shared/event-bus.js';

export const liveNoticeSchema = z.object({
  event: z.enum(domainEventNames),
  projectId: z.string().optional(),
  ticketNumber: z.number().optional(),
  changed: z.boolean().optional(),
  polledAt: z.string().optional(),
});

export type LiveNotice = z.infer<typeof liveNoticeSchema>;
