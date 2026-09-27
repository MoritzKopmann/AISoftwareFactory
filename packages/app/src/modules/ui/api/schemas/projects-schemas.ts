import { z } from 'zod';

export const addProjectRequestSchema = z.object({
  checkoutPath: z.string().min(1),
});
export type AddProjectRequest = z.infer<typeof addProjectRequestSchema>;

export const projectResponseSchema = z.object({
  id: z.string(),
  repository: z.object({ owner: z.string(), name: z.string() }),
  checkoutPath: z.string(),
  addedAt: z.string(),
});
export type ProjectResponse = z.infer<typeof projectResponseSchema>;

export const projectListResponseSchema = z.array(projectResponseSchema);
export type ProjectListResponse = z.infer<typeof projectListResponseSchema>;

export const errorResponseSchema = z.object({ message: z.string() });
export type ErrorResponse = z.infer<typeof errorResponseSchema>;
