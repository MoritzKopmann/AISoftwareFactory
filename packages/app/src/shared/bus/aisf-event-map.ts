export type AisfEventMap = {
  readonly 'project.added': {
    readonly projectId: string;
    readonly repository: { readonly owner: string; readonly name: string };
    readonly checkoutPath: string;
  };
};
