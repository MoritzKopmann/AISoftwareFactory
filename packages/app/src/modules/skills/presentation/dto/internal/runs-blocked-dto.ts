export type RunsBlockedDto =
  { readonly blocked: false } | { readonly blocked: true; readonly reason: string };
