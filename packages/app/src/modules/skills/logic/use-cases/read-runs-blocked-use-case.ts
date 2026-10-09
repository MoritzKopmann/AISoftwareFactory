import { determineRunsBlocked } from '../domain/functions/determine-runs-blocked.js';
import type { RunsBlocked } from '../domain/types/skills-status.js';
import type { SkillsStatusStore } from '../ports/skills-status-store.js';

export type ReadRunsBlockedDependencies = {
  readonly statusStore: SkillsStatusStore;
};

export class ReadRunsBlockedUseCase {
  constructor(private readonly dependencies: ReadRunsBlockedDependencies) {}

  execute(): RunsBlocked {
    const { statusStore } = this.dependencies;
    return determineRunsBlocked(statusStore.status(), statusStore.credentials());
  }
}
