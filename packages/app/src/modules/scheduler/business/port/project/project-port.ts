import type { RepositoryReference } from '../../domain/types/repository-reference.js';

export type SchedulerProject = {
  readonly repository: RepositoryReference;
  readonly onboarded: boolean;
  readonly paused: boolean;
};

export interface ProjectPort {
  find(projectId: string): Promise<SchedulerProject | undefined>;
}
