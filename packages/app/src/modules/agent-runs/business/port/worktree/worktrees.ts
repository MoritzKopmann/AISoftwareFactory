import type { DetachedWorktreeSpec } from '../../domain/types/detached-worktree-spec.js';
import type { RemovableWorktreeSpec } from '../../domain/types/removable-worktree-spec.js';
import type { WorktreeSpec } from '../../domain/types/worktree-spec.js';

export interface Worktrees {
  ensure(spec: WorktreeSpec): Promise<void>;
  ensureDetached(spec: DetachedWorktreeSpec): Promise<void>;
  /** Removes the folder and git's record of it, even with uncommitted changes. The branch stays. */
  remove(spec: RemovableWorktreeSpec): Promise<void>;
}
