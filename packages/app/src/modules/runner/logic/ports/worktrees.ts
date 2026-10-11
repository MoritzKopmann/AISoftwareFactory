import type { DetachedWorktreeSpec } from '../domain/types/detached-worktree-spec.js';
import type { WorktreeSpec } from '../domain/types/worktree-spec.js';

export interface Worktrees {
  ensure(spec: WorktreeSpec): Promise<void>;
  ensureDetached(spec: DetachedWorktreeSpec): Promise<void>;
}
