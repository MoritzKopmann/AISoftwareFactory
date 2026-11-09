import { z } from 'zod';
import type { AgentTool } from '../../../../shared/agent-tools.js';

const inputShape = {
  blocker: z
    .number()
    .int()
    .positive()
    .describe('The number of the ticket that must land before this one can be finished'),
};
const inputSchema = z.object(inputShape);

export function createParkTool(): AgentTool {
  return {
    name: 'aisf_park',
    description:
      'Park the ticket when you find a hidden dependency on another ticket while working: you cannot finish until that ticket lands. Park it behind that blocking ticket, which you have already linked. Ends the run: the ticket goes back to ready.',
    inputShape,
    execute: async (input) => {
      const { blocker } = inputSchema.parse(input);
      return {
        text: 'Park recorded. The run ends now: stop working and end your turn.',
        ending: { kind: 'parked', blockerNumber: blocker },
      };
    },
  };
}
