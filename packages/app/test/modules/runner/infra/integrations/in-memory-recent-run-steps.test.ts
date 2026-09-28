import { describe, expect, it } from 'vitest';
import { InMemoryRecentRunSteps } from '../../../../../src/modules/runner/infra/integrations/in-memory-recent-run-steps.js';

describe('InMemoryRecentRunSteps', () => {
  it('should return the steps of a run in the order they were appended', () => {
    const recentRunSteps = new InMemoryRecentRunSteps();

    recentRunSteps.append('run-1', { at: 'a', summary: 'first' });
    recentRunSteps.append('run-1', { at: 'b', summary: 'second' });

    expect(recentRunSteps.read('run-1').map((step) => step.summary)).toEqual(['first', 'second']);
  });

  it('should keep only the last five steps when more are appended', () => {
    const recentRunSteps = new InMemoryRecentRunSteps();

    for (const number of [1, 2, 3, 4, 5, 6, 7]) {
      recentRunSteps.append('run-1', { at: 'a', summary: `step ${number}` });
    }

    expect(recentRunSteps.read('run-1').map((step) => step.summary)).toEqual([
      'step 3',
      'step 4',
      'step 5',
      'step 6',
      'step 7',
    ]);
  });

  it('should keep the steps of each run apart when two runs append', () => {
    const recentRunSteps = new InMemoryRecentRunSteps();

    recentRunSteps.append('run-1', { at: 'a', summary: 'one' });
    recentRunSteps.append('run-2', { at: 'a', summary: 'two' });

    expect(recentRunSteps.read('run-1')).toEqual([{ at: 'a', summary: 'one' }]);
  });

  it('should return no steps when the run is unknown', () => {
    expect(new InMemoryRecentRunSteps().read('missing')).toEqual([]);
  });
});
