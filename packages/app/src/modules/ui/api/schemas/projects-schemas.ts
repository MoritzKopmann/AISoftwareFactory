import { z } from 'zod';

export const addProjectRequestSchema = z.object({
  checkoutPath: z.string().min(1),
});
export type AddProjectRequest = z.infer<typeof addProjectRequestSchema>;

export const contractPreflightReportSchema = z.object({
  passed: z.boolean(),
  missingSlots: z.array(z.string()),
  missingHeadings: z.array(z.object({ slot: z.string(), heading: z.string() })),
  missingKeys: z.array(z.string()),
});
export type ContractPreflightReportResponse = z.infer<typeof contractPreflightReportSchema>;

export const projectResponseSchema = z.object({
  id: z.string(),
  repository: z.object({ owner: z.string(), name: z.string() }),
  checkoutPath: z.string(),
  addedAt: z.string(),
  contract: contractPreflightReportSchema,
});
export type ProjectResponse = z.infer<typeof projectResponseSchema>;

export const projectListResponseSchema = z.array(projectResponseSchema);
export type ProjectListResponse = z.infer<typeof projectListResponseSchema>;

export const errorResponseSchema = z.object({ message: z.string() });
export type ErrorResponse = z.infer<typeof errorResponseSchema>;
