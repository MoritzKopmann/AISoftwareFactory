import type { PolicyRule } from '../types/policy-rule.js';
import type { PolicyVerdict } from '../types/policy-verdict.js';

export function denyToolCall(rule: PolicyRule, explanation: string): PolicyVerdict {
  return { kind: 'deny', rule, reason: `${rule}: ${explanation}` };
}
