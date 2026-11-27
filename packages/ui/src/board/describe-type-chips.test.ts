import { describe, expect, it } from 'vitest';
import { describeTypeChips } from './describe-type-chips.js';

describe('describeTypeChips', () => {
  it('should list the chips as UI, SPIKE, SKILL, BUG when the types are bug, skill, ui and spike', () => {
    const chips = describeTypeChips(['bug', 'skill', 'ui', 'spike']);

    expect(chips).toEqual([
      { type: 'ui', label: 'UI' },
      { type: 'spike', label: 'SPIKE' },
      { type: 'skill', label: 'SKILL' },
      { type: 'bug', label: 'BUG' },
    ]);
  });

  it('should list a BUG chip when the types are only bug', () => {
    const chips = describeTypeChips(['bug']);

    expect(chips).toEqual([{ type: 'bug', label: 'BUG' }]);
  });

  it('should list no chip when the types are only enhancement', () => {
    const chips = describeTypeChips(['enhancement']);

    expect(chips).toEqual([]);
  });

  it('should list no chip when there are no types', () => {
    const chips = describeTypeChips([]);

    expect(chips).toEqual([]);
  });
});
