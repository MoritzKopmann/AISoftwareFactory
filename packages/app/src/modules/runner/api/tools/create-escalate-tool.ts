import { z } from 'zod';
import type { RunTool } from '../../logic/domain/types/run-tool.js';

const inputShape = {
  kind: z.enum(['red', 'spec', 'denied']).describe('Why the run gives up'),
  reason: z
    .string()
    .min(1)
    .describe('What was tried, what failed (pasted output), and what a human must decide'),
};
const inputSchema = z.object(inputShape);

export function createEscalateTool(): RunTool {
  return {
    name: 'aisf_escalate',
    description:
      'Give up on the ticket and hand it to a human. Ends the run: the ticket goes to stuck with your reason as a comment.',
    inputShape,
    execute: async (input) => {
      const { kind, reason } = inputSchema.parse(input);
      return {
        text: 'Escalation recorded. The run ends now: stop working and end your turn.',
        ending: { kind: 'escalated', escalation: kind, reason },
      };
    },
  };
}
