import { describe, expect, it } from 'vitest';
import { evaluatePathRules } from '../../../../../../src/modules/runner/logic/domain/functions/evaluate-path-rules.js';
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

describe('evaluatePathRules', () => {
  it.each([
    `${worktreePath}/src/a.ts`,
    'src/a.ts',
    `${worktreePath}/../7/src/a.ts`,
    `${worktreePath}/.claude/skills/other-skill/SKILL.md`,
    `${worktreePath}/.claude/commands/run.md`,
  ])('should allow an edit of %s', (filePath) => {
    expect(evaluatePathRules(filePath, context)).toEqual({ kind: 'allow' });
  });

  it('should allow an edit inside the worktree when the worktree path has a trailing slash', () => {
    const slashedContext = { ...context, worktreePath: `${worktreePath}/` };

    expect(evaluatePathRules(`${worktreePath}/src/a.ts`, slashedContext)).toEqual({
      kind: 'allow',
    });
  });

  it.each<[string, PolicyRule]>([
    ['/etc/passwd', 'edit-outside-worktree'],
    ['/tmp/scratch.txt', 'edit-outside-worktree'],
    ['../../../../../code/x.ts', 'edit-outside-worktree'],
    ['/home/user/code/project/src/a.ts', 'edit-outside-worktree'],
    [`${worktreePath}-sibling/a.ts`, 'edit-protected-path'],
    ['../other/file.ts', 'edit-protected-path'],
    ['/home/user/.aisf/worktrees/project/70/a.ts', 'edit-protected-path'],
    ['/home/user/.aisf/aisf.db', 'edit-protected-path'],
    ['/home/user/.claude/plugins/aisf/skills/x/SKILL.md', 'edit-protected-path'],
    [`${worktreePath}/.claude/settings.json`, 'edit-policy-file'],
    [`${worktreePath}/.claude/settings.local.json`, 'edit-policy-file'],
    [`${worktreePath}/.claude/hooks/pre-tool-use.sh`, 'edit-policy-file'],
    [`${worktreePath}/.claude/skills/project-testing/SKILL.md`, 'edit-policy-file'],
    ['/home/user/code/project/.claude/settings.json', 'edit-policy-file'],
  ])('should deny an edit of %s with rule %s', (filePath, rule) => {
    const verdict = evaluatePathRules(filePath, context);

    expect(verdict).toMatchObject({ kind: 'deny', rule });
    expect(verdict).toMatchObject({ reason: expect.stringContaining(rule) });
  });
});
