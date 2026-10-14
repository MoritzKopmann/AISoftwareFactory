import type { ProjectLabelService } from '../../business/service/project-label-service.js';

/** Job `projects.sync-labels`: creates the aisf labels a registered project lacks. */
export function createProjectsSyncLabelsJob(
  projectLabelService: ProjectLabelService,
): () => Promise<void> {
  return () => projectLabelService.syncLabels();
}
