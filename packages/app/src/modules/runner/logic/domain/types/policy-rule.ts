export type PolicyRule =
  | 'gh-merge'
  | 'gh-admin'
  | 'push-default-branch'
  | 'push-other-branch'
  | 'push-mirror-or-all'
  | 'push-delete'
  | 'force-push-other-branch'
  | 'edit-outside-worktree'
  | 'edit-protected-path'
  | 'edit-policy-file';
