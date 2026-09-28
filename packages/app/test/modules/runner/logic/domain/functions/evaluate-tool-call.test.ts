import { describe, expect, it } from 'vitest';
import { evaluateToolCall } from '../../../../../../src/modules/runner/logic/domain/functions/evaluate-tool-call.js';
import type { PolicyRule } from '../../../../../../src/modules/runner/logic/domain/types/policy-rule.js';
import type { RunPolicyContext } from '../../../../../../src/modules/runner/logic/domain/types/run-policy-context.js';

const worktreePath = '/home/user/.aisf/worktrees/project/7';
const context: RunPolicyContext = {
  worktreePath,
  branchName: 'aisf/7-add-thing',
  defaultBranch: 'main',
  checkoutPath: '/home/user/code/project',
  protectedPaths: ['/home/user/.aisf', '/home/user/.claude/plugins/aisf'],
};

function bash(command: string) {
  return { toolName: 'Bash', input: { command } };
}

describe('evaluateToolCall', () => {
  it.each([
    bash('git push -u origin HEAD'),
    bash('git push --force-with-lease origin aisf/7-add-thing'),
    bash('gh issue edit 12 --add-label "status: ready"'),
    bash('npm test && git status'),
    bash('git push -u origin HEAD 2>&1 | tail -5'),
    bash('git push origin HEAD > /dev/null'),
    bash('git push -u \\\n  origin HEAD'),
    { toolName: 'Edit', input: { file_path: `${worktreePath}/src/a.ts` } },
    { toolName: 'Write', input: { file_path: 'src/new.ts', content: 'x' } },
    { toolName: 'Read', input: { file_path: '/etc/hosts' } },
    { toolName: 'Grep', input: { pattern: 'x' } },
    { toolName: 'mcp__aisf__aisf_escalate', input: { kind: 'red', reason: 'x' } },
    bash(''),
    { toolName: 'Bash', input: {} },
  ])('should allow %j', (toolCall) => {
    expect(evaluateToolCall(toolCall, context)).toEqual({ kind: 'allow' });
  });

  it.each<[string, PolicyRule]>([
    ['gh pr merge 3 --rebase', 'gh-merge'],
    ['git push origin main', 'push-default-branch'],
    ['git push --mirror', 'push-mirror-or-all'],
    ['git push origin --delete aisf/7-add-thing', 'push-delete'],
    ['git push -f origin aisf/8-other', 'force-push-other-branch'],
    ['gh release create v1', 'gh-admin'],
  ])('should deny the Bash command %s with rule %s', (command, rule) => {
    expect(evaluateToolCall(bash(command), context)).toMatchObject({ kind: 'deny', rule });
  });

  it.each<[string, PolicyRule]>([
    ['npm test && gh pr merge 3', 'gh-merge'],
    ['bash -c "npm test && gh pr merge 3"', 'gh-merge'],
    ["sh -c 'cd x; git push origin main'", 'push-default-branch'],
    ['eval "git push --all"', 'push-mirror-or-all'],
    ['echo $(gh pr merge 3)', 'gh-merge'],
    ['timeout 30 gh pr merge 3', 'gh-merge'],
    ['nice -n 5 gh pr merge 3', 'gh-merge'],
    ['sudo -u root gh pr merge 3', 'gh-merge'],
    ['env -u FOO git push origin main', 'push-default-branch'],
    ['/usr/bin/gh pr merge 3', 'gh-merge'],
    ['xargs gh pr merge', 'gh-merge'],
    ['bash -c "bash -c \\"gh pr merge 3\\""', 'gh-merge'],
    ['git status | tee out; git push origin HEAD:main', 'push-default-branch'],
  ])('should deny the wrapped Bash command %s with rule %s', (command, rule) => {
    expect(evaluateToolCall(bash(command), context)).toMatchObject({ kind: 'deny', rule });
  });

  it.each<[string, PolicyRule]>([
    ['Edit', 'edit-outside-worktree'],
    ['Write', 'edit-outside-worktree'],
    ['MultiEdit', 'edit-outside-worktree'],
  ])('should deny %s outside the worktree with rule %s', (toolName, rule) => {
    const toolCall = { toolName, input: { file_path: '/etc/passwd' } };

    expect(evaluateToolCall(toolCall, context)).toMatchObject({ kind: 'deny', rule });
  });

  it('should deny a notebook edit outside the worktree when it names notebook_path', () => {
    const toolCall = { toolName: 'NotebookEdit', input: { notebook_path: '/tmp/a.ipynb' } };

    expect(evaluateToolCall(toolCall, context)).toMatchObject({
      kind: 'deny',
      rule: 'edit-outside-worktree',
    });
  });

  it('should deny a policy file edit when the path is inside the worktree', () => {
    const toolCall = {
      toolName: 'Edit',
      input: { file_path: `${worktreePath}/.claude/settings.json` },
    };

    expect(evaluateToolCall(toolCall, context)).toMatchObject({
      kind: 'deny',
      rule: 'edit-policy-file',
    });
  });
});
