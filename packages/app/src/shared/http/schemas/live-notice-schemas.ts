import { z } from 'zod';
import { aisfEventNames } from '../../bus/aisf-event-names.js';

export const liveNoticeSchema = z.object({
  event: z.enum(aisfEventNames),
  projectId: z.string().optional(),
  ticketNumber: z.number().optional(),
});

export type LiveNotice = z.infer<typeof liveNoticeSchema>;
