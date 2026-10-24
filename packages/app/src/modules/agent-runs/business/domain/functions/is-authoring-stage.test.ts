import { describe, expect, it } from 'vitest';
import { isAuthoringStage } from './is-authoring-stage.js';

describe('isAuthoringStage', () => {
  it.each(['create', 'plan', 'design'] as const)('should be true when the stage is %s', (stage) => {
    expect(isAuthoringStage(stage)).toBe(true);
  });

  it.each(['implement', 'spike', 'onboard'] as const)(
    'should be false when the stage is %s',
    (stage) => {
      expect(isAuthoringStage(stage)).toBe(false);
    },
  );
});
