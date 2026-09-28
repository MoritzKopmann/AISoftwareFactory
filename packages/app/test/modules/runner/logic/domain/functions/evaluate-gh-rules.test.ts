import { describe, expect, it } from 'vitest';
import { evaluateGhRules } from '../../../../../../src/modules/runner/logic/domain/functions/evaluate-gh-rules.js';
import type { PolicyRule } from '../../../../../../src/modules/runner/logic/domain/types/policy-rule.js';

function evaluate(command: string) {
  return evaluateGhRules(command.split(' '));
}

describe('evaluateGhRules', () => {
  it.each([
    'gh issue edit 12 --add-label bug',
    'gh issue comment 12 --body-file body.md',
    'gh issue view 12 --json title',
    'gh pr create --base main --title x --body-file body.md',
    'gh pr view --json url',
    'gh pr comment 3 --body-file body.md',
    'gh pr edit 3 --base main',
    'gh api repos/o/r/pulls/3/comments/9/replies -f body=hi',
    'gh api repos/o/r/pulls/3/requested_reviewers -X POST -f reviewers[]=x',
    'gh api repos/o/r/pulls/3/merge',
    'gh api repos/o/r/releases',
    'gh api graphql -f query=query{viewer{login}}',
    'gh repo view',
    'gh release list',
    'git status',
  ])('should allow %s', (command) => {
    expect(evaluate(command)).toEqual({ kind: 'allow' });
  });

  it.each<[string, PolicyRule]>([
    ['gh pr merge 3', 'gh-merge'],
    ['gh pr merge --auto --rebase 3', 'gh-merge'],
    ['gh api -X PUT repos/o/r/pulls/3/merge', 'gh-merge'],
    ['gh api --method=PUT repos/o/r/pulls/3/merge -f merge_method=rebase', 'gh-merge'],
    ['gh api repos/o/r/pulls/3/merge -f merge_method=rebase', 'gh-merge'],
    ['gh api -X POST repos/o/r/merges -f base=main -f head=x', 'gh-merge'],
    [
      'gh api graphql -f query=mutation{mergePullRequest(input:{pullRequestId:"x"}){clientMutationId}}',
      'gh-merge',
    ],
    [
      'gh api graphql -f query=mutation{enablePullRequestAutoMerge(input:{pullRequestId:"x"}){clientMutationId}}',
      'gh-merge',
    ],
    ['gh release create v1', 'gh-admin'],
    ['gh release delete v1', 'gh-admin'],
    ['gh repo edit --visibility public', 'gh-admin'],
    ['gh repo delete o/r --yes', 'gh-admin'],
    ['gh secret set TOKEN', 'gh-admin'],
    ['gh variable set NAME', 'gh-admin'],
    ['gh workflow run ci.yml', 'gh-admin'],
    ['gh api -X POST repos/o/r/actions/workflows/ci.yml/dispatches -f ref=main', 'gh-admin'],
    ['gh api -X PUT repos/o/r/actions/secrets/TOKEN', 'gh-admin'],
    ['gh api -X POST repos/o/r/releases -f tag_name=v1', 'gh-admin'],
    ['gh api -X PATCH repos/o/r -f private=false', 'gh-admin'],
    ['gh api -X PUT repos/o/r/branches/main/protection', 'gh-admin'],
    ['gh -R o/r pr merge 1', 'gh-merge'],
    ['gh --repo o/r pr merge 1', 'gh-merge'],
    ['gh pr -R o/r merge 1', 'gh-merge'],
    ['gh -R o/r release create v1', 'gh-admin'],
    ['gh api -XPUT repos/o/r/pulls/1/merge', 'gh-merge'],
    ['gh api -XDELETE repos/o/r/releases/1', 'gh-admin'],
  ])('should deny %s with rule %s', (command, rule) => {
    const verdict = evaluate(command);

    expect(verdict).toMatchObject({ kind: 'deny', rule });
    expect(verdict).toMatchObject({ reason: expect.stringContaining(rule) });
  });
});
