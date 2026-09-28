export type RunAvailability =
  | { readonly kind: 'absent' }
  | { readonly kind: 'disabled'; readonly reason: string }
  | { readonly kind: 'available' };
