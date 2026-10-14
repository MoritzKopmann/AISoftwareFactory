import type { PermissionDecision } from './permission-decision.js';

export type RunAnswer =
  | { readonly kind: 'permission'; readonly decision: PermissionDecision }
  | { readonly kind: 'checkpoint'; readonly text: string };
