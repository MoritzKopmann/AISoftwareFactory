export type PermissionVerdict =
  { readonly kind: 'allow' } | { readonly kind: 'deny'; readonly message: string };
