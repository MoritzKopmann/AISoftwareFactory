export type RunsBlocked =
  { readonly blocked: false } | { readonly blocked: true; readonly reason: string };
