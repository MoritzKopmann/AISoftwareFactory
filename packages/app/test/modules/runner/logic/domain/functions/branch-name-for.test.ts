import { describe, expect, it } from 'vitest';
import { branchNameFor } from '../../../../../../src/modules/runner/logic/domain/functions/branch-name-for.js';

describe('branchNameFor', () => {
  it('should join the ticket number and the kebab-cased title when the title is plain words', () => {
    expect(branchNameFor(137, 'The runner takes a ticket')).toBe(
      'aisf/137-the-runner-takes-a-ticket',
    );
  });

  it('should collapse punctuation into single hyphens when the title has symbols', () => {
    expect(branchNameFor(7, 'Runner: AFK sessions -- in `worktrees`!')).toBe(
      'aisf/7-runner-afk-sessions-in-worktrees',
    );
  });

  it('should cut the slug at fifty characters without a trailing hyphen when the title is long', () => {
    const branchName = branchNameFor(
      1,
      'A very long title that goes on and on and on and on and on forever',
    );

    expect(branchName).toBe('aisf/1-a-very-long-title-that-goes-on-and-on-and-on-and-o');
  });

  it('should leave the slug out when the title has no letters or digits', () => {
    expect(branchNameFor(9, '!!!')).toBe('aisf/9');
  });
});
