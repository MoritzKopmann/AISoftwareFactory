import { z } from 'zod';
import type { RunTool } from '../../../runner/index.js';
import type { ReportFindingUseCase } from '../../logic/use-cases/report-finding-use-case.js';

const inputShape = {
  kind: z
    .enum(['bug', 'gap'])
    .describe('bug: the code does the wrong thing. gap: something the ticket should have covered'),
  location: z.string().min(1).describe('Where it is, as file:line'),
  summary: z.string().min(1).describe('One sentence saying what is wrong'),
};
const inputSchema = z.object(inputShape);

export function createReportFindingTool(reportFinding: ReportFindingUseCase): RunTool {
  return {
    name: 'aisf_report_finding',
    description:
      'Report a bug or gap found while implementing the ticket. It is stored for the human to turn into a ticket or dismiss. The run carries on.',
    inputShape,
    execute: async (input, runContext) => {
      const { kind, location, summary } = inputSchema.parse(input);
      await reportFinding.execute({
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
