import { describe, expect, it } from 'vitest';
import { authoringWorktreePathFor } from '../../../../../../src/modules/runner/logic/domain/functions/authoring-worktree-path-for.js';

describe('authoringWorktreePathFor', () => {
  it('should differ from the implement worktree path when the ticket is the same', () => {
    expect(authoringWorktreePathFor('/worktrees', 'aisf', 7)).toBe('/worktrees/aisf/7-authoring');
  });
});
