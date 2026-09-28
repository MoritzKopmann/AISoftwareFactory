import type { WorktreeSpec } from '../domain/types/worktree-spec.js';

export interface Worktrees {
  ensure(spec: WorktreeSpec): Promise<void>;
}
