import type { PolicyRule } from './policy-rule.js';

export type PolicyVerdict =
  | { readonly kind: 'allow' }
  | { readonly kind: 'deny'; readonly rule: PolicyRule; readonly reason: string };
