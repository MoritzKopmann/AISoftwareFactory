import { z } from 'zod';
import type { AgentTool } from '../../../../shared/agent-tools.js';

const inputShape = {
  kind: z
    .enum(['red', 'spec', 'denied'])
    .describe(
      'Why the run gives up. red: a step the run must pass still fails after fix attempts. spec: the ticket does not answer what the work needs. denied: a call the work cannot finish without was refused.',
    ),
  reason: z
    .string()
    .min(1)
    .describe(
      'What was tried, what failed (pasted output), and what a human must decide. For denied: the refused tool and its input.',
    ),
};
const inputSchema = z.object(inputShape);

export function createEscalateTool(): AgentTool {
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
