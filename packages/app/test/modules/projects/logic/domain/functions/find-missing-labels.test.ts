import { describe, expect, it } from 'vitest';
import type { AisfLabel } from '../../../../../../src/modules/projects/logic/domain/constants/aisf-labels.js';
import { findMissingLabels } from '../../../../../../src/modules/projects/logic/domain/functions/find-missing-labels.js';

const readyLabel: AisfLabel = {
  name: 'status: ready',
  color: '0E8A16',
  description: 'Leaf that may be implemented now',
};
const hitlLabel: AisfLabel = {
  name: 'hitl',
  color: 'F9A825',
  description: 'Runs as an interactive session, never AFK',
};

describe('findMissingLabels', () => {
  it('should return every aisf label when none exist', () => {
    expect(findMissingLabels([readyLabel, hitlLabel], [])).toEqual([readyLabel, hitlLabel]);
  });

  it('should return nothing when every aisf label already exists', () => {
    expect(findMissingLabels([readyLabel, hitlLabel], ['status: ready', 'hitl'])).toEqual([]);
  });

  it('should treat a name that differs only in case as present', () => {
    expect(findMissingLabels([readyLabel, hitlLabel], ['Status: Ready', 'HITL'])).toEqual([]);
  });

  it('should return only the aisf labels that are missing', () => {
    expect(findMissingLabels([readyLabel, hitlLabel], ['status: ready'])).toEqual([hitlLabel]);
  });

  it('should ignore an existing label that is not an aisf label', () => {
    expect(findMissingLabels([readyLabel], ['bug'])).toEqual([readyLabel]);
  });
});
