export type Project = {
  readonly id: string;
  readonly repository: { readonly owner: string; readonly name: string };
  readonly checkoutPath: string;
  readonly addedAt: string;
};
