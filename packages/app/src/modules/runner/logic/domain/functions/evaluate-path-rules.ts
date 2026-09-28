import { allowVerdict } from '../constants/allow-verdict.js';
import type { PolicyVerdict } from '../types/policy-verdict.js';
import type { RunPolicyContext } from '../types/run-policy-context.js';
import { denyToolCall } from './deny-tool-call.js';
import { isPathInside } from './is-path-inside.js';
import { resolvePath } from './resolve-path.js';

const policyFilePatterns: ReadonlyArray<RegExp> = [
  /\/\.claude\/settings[^/]*\.json$/,
  /\/\.claude\/hooks\//,
  /\/\.claude\/skills\/project-[^/]+\//,
];

export function evaluatePathRules(filePath: string, context: RunPolicyContext): PolicyVerdict {
  const worktreePath = resolvePath(context.worktreePath, '/');
  const resolvedPath = resolvePath(filePath, worktreePath);
  if (policyFilePatterns.some((pattern) => pattern.test(resolvedPath))) {
    return denyToolCall(
      'edit-policy-file',
      `${resolvedPath} holds policy, hook or project contract configuration.`,
    );
  }
  if (isPathInside(resolvedPath, worktreePath)) {
    return allowVerdict;
  }
  if (
    context.protectedPaths.some((protectedPath) =>
      isPathInside(resolvedPath, resolvePath(protectedPath, '/')),
    )
  ) {
    return denyToolCall('edit-protected-path', `${resolvedPath} is app-owned.`);
  }
  return denyToolCall(
    'edit-outside-worktree',
    `${resolvedPath} is outside the run's worktree ${worktreePath}.`,
  );
}
