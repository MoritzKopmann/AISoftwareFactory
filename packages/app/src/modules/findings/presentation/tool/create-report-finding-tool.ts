import { z } from 'zod';
import type { AgentTool } from '../../../../shared/agent-tools.js';
import type { FindingService } from '../../business/service/finding-service.js';

const inputShape = {
  kind: z
    .enum(['bug', 'gap'])
    .describe('bug: the code does the wrong thing. gap: something the ticket should have covered'),
  location: z.string().min(1).describe('Where it is, as file:line'),
  summary: z.string().min(1).describe('One sentence saying what is wrong'),
};
const inputSchema = z.object(inputShape);

export function createReportFindingTool(findingService: Pick<FindingService, 'report'>): AgentTool {
  return {
    name: 'aisf_report_finding',
    description:
      'Report a bug or gap found while implementing the ticket. It is stored for the human to turn into a ticket or dismiss. The run carries on.',
    inputShape,
    execute: async (input, runContext) => {
      const { kind, location, summary } = inputSchema.parse(input);
      await findingService.report({
        projectId: runContext.projectId,
        ticketNumber: runContext.ticketNumber,
        runId: runContext.runId,
        kind,
        location,
        summary,
      });
      return { text: 'Finding recorded.' };
    },
  };
}
