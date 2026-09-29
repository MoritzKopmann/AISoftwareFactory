import type { RepositoryReference } from '../domain/types/repository-reference.js';

export type FindingsProject = {
  readonly repository: RepositoryReference;
};

export interface ProjectLookup {
  find(projectId: string): Promise<FindingsProject | undefined>;
}
