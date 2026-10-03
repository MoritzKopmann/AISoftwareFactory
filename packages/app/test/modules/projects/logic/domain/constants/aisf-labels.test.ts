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

  it('should contain exactly one status: waiting entry when the list is read', () => {
    expect(aisfLabels.filter((label) => label.name === 'status: waiting')).toEqual([
      {
        name: 'status: waiting',
        color: 'D876E3',
        description: 'A run waits at its human checkpoint',
      },
    ]);
  });

  it('should place status: waiting directly after status: in-progress when the list is read', () => {
    const names = aisfLabels.map((label) => label.name);

    expect(names[names.indexOf('status: in-progress') + 1]).toBe('status: waiting');
  });

  it('should describe the checkpoint on hitl and keep its colour when the list is read', () => {
    expect(aisfLabels.find((label) => label.name === 'hitl')).toEqual({
      name: 'hitl',
      color: 'F9A825',
      description: 'Has one human checkpoint; the run waits there for an answer',
    });
  });

  it('should keep the status: in-review description when approved is added', () => {
    expect(aisfLabels.find((label) => label.name === 'status: in-review')?.description).toBe(
      'PR open, awaiting review',
    );
  });
});
