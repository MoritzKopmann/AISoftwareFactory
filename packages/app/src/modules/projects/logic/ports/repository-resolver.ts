export type RepositoryReference = { readonly owner: string; readonly name: string };

export interface RepositoryResolver {
  resolve(checkoutPath: string): Promise<RepositoryReference>;
}
