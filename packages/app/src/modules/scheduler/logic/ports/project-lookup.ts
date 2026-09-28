import type { RepositoryReference } from '../domain/types/repository-reference.js';

export type SchedulerProject = {
  readonly repository: RepositoryReference;
  readonly onboarded: boolean;
};

export interface ProjectLookup {
  find(projectId: string): Promise<SchedulerProject | undefined>;
}
