export type RunPolicyContext = {
  readonly worktreePath: string;
  readonly branchName: string;
  readonly defaultBranch: string;
  readonly checkoutPath: string;
  readonly protectedPaths: ReadonlyArray<string>;
};
