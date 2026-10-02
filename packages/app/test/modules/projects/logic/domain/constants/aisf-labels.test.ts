import { describe, expect, it } from 'vitest';
import { aisfLabels } from '../../../../../../src/modules/projects/logic/domain/constants/aisf-labels.js';

describe('aisfLabels', () => {
  it('should contain exactly one approved entry when the list is read', () => {
    expect(aisfLabels.filter((label) => label.name === 'approved')).toEqual([
      {
        name: 'approved',
        color: '1A7F37',
        description: 'Set by the human on a pull request; the app then rebase-merges it',
      },
    ]);
  });

  it('should place approved directly after hitl when the list is read', () => {
    const names = aisfLabels.map((label) => label.name);

    expect(names[names.indexOf('hitl') + 1]).toBe('approved');
  });

  it('should keep the status: in-review description when approved is added', () => {
    expect(aisfLabels.find((label) => label.name === 'status: in-review')?.description).toBe(
      'PR open, awaiting review',
    );
  });
});
