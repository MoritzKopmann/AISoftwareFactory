import type { SkillsStatus } from '../domain/types/skills-status.js';
import type { SkillsStatusStore } from '../ports/skills-status-store.js';

export type ReadSkillsStatusDependencies = {
  readonly statusStore: SkillsStatusStore;
};

export class ReadSkillsStatusUseCase {
  constructor(private readonly dependencies: ReadSkillsStatusDependencies) {}

  execute(): SkillsStatus {
    return this.dependencies.statusStore.status();
  }
}
