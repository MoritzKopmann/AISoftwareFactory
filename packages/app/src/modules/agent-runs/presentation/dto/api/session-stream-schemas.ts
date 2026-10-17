import { z } from 'zod';

export const sessionEntryResponseSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('prompt'), id: z.string(), text: z.string() }),
  z.object({ kind: z.literal('text'), id: z.string(), text: z.string() }),
  z.object({
    kind: z.literal('handback'),
    id: z.string(),
    agentId: z.string().nullable(),
    text: z.string(),
  }),
  z.object({
    kind: z.literal('tool-call'),
    id: z.string(),
    toolUseId: z.string(),
    name: z.string(),
    input: z.unknown(),
    label: z.string().optional(),
  }),
  z.object({
    kind: z.literal('tool-result'),
    id: z.string(),
    toolUseId: z.string(),
    isError: z.boolean(),
    parts: z.array(
      z.discriminatedUnion('kind', [
        z.object({ kind: z.literal('text'), text: z.string() }),
        z.object({ kind: z.literal('image'), mediaType: z.string(), data: z.string() }),
      ]),
    ),
    agentId: z.string().optional(),
  }),
]);
export type SessionEntryResponse = z.infer<typeof sessionEntryResponseSchema>;

export const sessionStreamFrameSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('snapshot'),
    entries: z.array(sessionEntryResponseSchema),
    root: z.string(),
  }),
  z.object({ kind: z.literal('no-session') }),
  z.object({ kind: z.literal('transcript-not-found') }),
  z.object({ kind: z.literal('entry'), entry: sessionEntryResponseSchema }),
  z.object({ kind: z.literal('delta'), opensBlock: z.boolean(), text: z.string() }),
  z.object({ kind: z.literal('label'), toolUseId: z.string(), label: z.string() }),
  z.object({ kind: z.literal('ended') }),
]);
export type SessionStreamFrame = z.infer<typeof sessionStreamFrameSchema>;
