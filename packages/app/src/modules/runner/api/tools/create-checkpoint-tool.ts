import { z } from 'zod';
import type { RunTool } from '../../logic/domain/types/run-tool.js';

const inputShape = {
  request: z
    .string()
    .min(1)
    .max(10_000)
    .describe('What the human must do at the checkpoint and what to answer. No secrets.'),
};
const inputSchema = z.object(inputShape);

export function createCheckpointTool(): RunTool {
  return {
    name: 'aisf_checkpoint',
    description:
      "Use this only at a `hitl` leaf's human checkpoint. It pauses the run until a human answers on the ticket page. The request is posted as a public comment on the ticket, so it must contain no secrets, tokens or credentials. The request should say what the human must do and what to answer.",
    inputShape,
    execute: async (input) => {
      const { request } = inputSchema.parse(input);
      return { wait: { kind: 'checkpoint', request } };
    },
  };
}
