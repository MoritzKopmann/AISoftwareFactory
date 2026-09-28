import { describe, expect, it } from 'vitest';
import { evaluateGitPushRules } from '../../../../../../src/modules/runner/logic/domain/functions/evaluate-git-push-rules.js';
import type { PolicyRule } from '../../../../../../src/modules/runner/logic/domain/types/policy-rule.js';
import type { RunPolicyContext } from '../../../../../../src/modules/runner/logic/domain/types/run-policy-context.js';

const context: RunPolicyContext = {
  worktreePath: '/home/user/.aisf/worktrees/project/7',
  branchName: 'aisf/7-add-thing',
  defaultBranch: 'main',
  checkoutPath: '/home/user/code/project',
  protectedPaths: [],
};

function evaluate(command: string) {
  return evaluateGitPushRules(command.split(' '), context);
}

describe('evaluateGitPushRules', () => {
  it.each([
    'git push',
    'git push -u origin HEAD',
    'git push origin aisf/7-add-thing',
    'git push origin HEAD:aisf/7-add-thing',
    'git push origin HEAD:refs/heads/aisf/7-add-thing',
    'git push --force-with-lease origin aisf/7-add-thing',
    'git push -f origin HEAD',
    'git push origin +aisf/7-add-thing',
    'git -C /some/dir push origin HEAD',
    'git status',
    'git fetch origin main',
  ])('should allow %s', (command) => {
    expect(evaluate(command)).toEqual({ kind: 'allow' });
  });

  it.each<[string, PolicyRule]>([
    ['git push origin main', 'push-default-branch'],
    ['git push origin HEAD:main', 'push-default-branch'],
    ['git push origin HEAD:refs/heads/main', 'push-default-branch'],
    ['git push -f origin main', 'push-default-branch'],
    ['git push origin aisf/8-other-ticket', 'push-other-branch'],
    ['git push origin some-branch', 'push-other-branch'],
    ['git push origin refs/heads/*:refs/heads/*', 'push-other-branch'],
    ['git push --mirror origin', 'push-mirror-or-all'],
    ['git push --all origin', 'push-mirror-or-all'],
    ['git push origin --delete aisf/7-add-thing', 'push-delete'],
    ['git push -d origin aisf/8-other-ticket', 'push-delete'],
    ['git push origin :aisf/8-other-ticket', 'push-delete'],
    ['git push --force origin aisf/8-other-ticket', 'force-push-other-branch'],
    ['git push origin +aisf/8-other-ticket', 'force-push-other-branch'],
    ['git --git-dir .git push origin main', 'push-default-branch'],
    ['git --work-tree /x -c a=b push origin main', 'push-default-branch'],
  ])('should deny %s with rule %s', (command, rule) => {
    const verdict = evaluate(command);

    expect(verdict).toMatchObject({ kind: 'deny', rule });
    expect(verdict).toMatchObject({ reason: expect.stringContaining(rule) });
  });
});
