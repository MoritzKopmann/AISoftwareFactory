import type { ProjectResponse } from '@aisf/app/api-schemas/projects-schemas.js';
import { isRequestFailure } from '../shared/is-request-failure.js';

export type LoadProjectsOutcome =
  | { readonly kind: 'loaded'; readonly projects: ReadonlyArray<ProjectResponse> }
  | { readonly kind: 'failed'; readonly detail: string };

export async function loadProjects(
  request: (url: string) => Promise<Response>,
): Promise<LoadProjectsOutcome> {
  try {
    const response = await request('/api/projects');
    if (!response.ok) {
      return { kind: 'failed', detail: `HTTP ${response.status}` };
    }
    return { kind: 'loaded', projects: (await response.json()) as ReadonlyArray<ProjectResponse> };
  } catch (error) {
    if (!isRequestFailure(error)) throw error;
    return { kind: 'failed', detail: "Can't reach aisf." };
  }
}
