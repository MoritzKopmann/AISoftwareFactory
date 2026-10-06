import { describe, expect, it } from 'vitest';
import { artifactDirectoryFor } from '../../../../../../src/modules/bridge/logic/domain/functions/artifact-directory-for.js';

describe('artifactDirectoryFor', () => {
  it('should name the artifact folder under .aisf/artifacts when given a worktree', () => {
    expect(artifactDirectoryFor('/worktrees/n/7', 'plan')).toBe(
      '/worktrees/n/7/.aisf/artifacts/plan',
    );
  });
});
