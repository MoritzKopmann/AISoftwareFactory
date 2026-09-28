import { describe, expect, it } from 'vitest';
import { worktreePathFor } from '../../../../../../src/modules/runner/logic/domain/functions/worktree-path-for.js';

describe('worktreePathFor', () => {
  it('should nest the ticket under the repository name inside the worktrees directory', () => {
    expect(worktreePathFor('/home/user/.aisf/worktrees', 'AISoftwareFactory', 137)).toBe(
      '/home/user/.aisf/worktrees/AISoftwareFactory/137',
    );
  });
});
