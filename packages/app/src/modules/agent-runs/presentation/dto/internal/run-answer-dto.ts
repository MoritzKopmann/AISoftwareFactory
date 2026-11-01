export type RunAnswerDto =
  | { readonly kind: 'permission'; readonly decision: 'allow' | 'deny' }
  | { readonly kind: 'checkpoint'; readonly text: string }
  | { readonly kind: 'message'; readonly text: string };
