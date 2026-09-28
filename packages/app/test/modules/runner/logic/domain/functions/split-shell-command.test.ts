import { describe, expect, it } from 'vitest';
import { splitShellCommand } from '../../../../../../src/modules/runner/logic/domain/functions/split-shell-command.js';

describe('splitShellCommand', () => {
  it('should return the words of a plain command', () => {
    expect(splitShellCommand('git push origin HEAD')).toEqual([['git', 'push', 'origin', 'HEAD']]);
  });

  it('should return one command per chained part when commands are chained', () => {
    expect(splitShellCommand('npm test && gh pr merge 1; echo done | cat')).toEqual([
      ['npm', 'test'],
      ['gh', 'pr', 'merge', '1'],
      ['echo', 'done'],
      ['cat'],
    ]);
  });

  it('should keep a quoted argument as one word when it contains separators', () => {
    expect(splitShellCommand("git commit -m 'a && b; c'")).toEqual([
      ['git', 'commit', '-m', 'a && b; c'],
    ]);
  });

  it('should include the commands inside bash -c when the command is wrapped', () => {
    const commands = splitShellCommand('bash -c "cd x && gh pr merge 5"');

    expect(commands).toContainEqual(['gh', 'pr', 'merge', '5']);
  });

  it('should include the commands inside eval when the command is evaluated', () => {
    expect(splitShellCommand('eval gh pr merge 5')).toContainEqual(['gh', 'pr', 'merge', '5']);
  });

  it('should include the commands inside a substitution when one is used', () => {
    expect(splitShellCommand('echo "$(gh pr merge 5)"')).toContainEqual(['gh', 'pr', 'merge', '5']);
    expect(splitShellCommand('echo `gh pr merge 5`')).toContainEqual(['gh', 'pr', 'merge', '5']);
  });

  it('should drop env assignments and wrapper programs when they lead the command', () => {
    expect(splitShellCommand('GH_TOKEN=x sudo env -i gh pr merge 5')).toContainEqual([
      'gh',
      'pr',
      'merge',
      '5',
    ]);
  });
});
