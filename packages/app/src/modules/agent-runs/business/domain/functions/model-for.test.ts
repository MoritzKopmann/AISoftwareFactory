import { describe, expect, it } from 'vitest';
import { stageModels } from '../constants/stage-models.js';
import type { RunStage } from '../types/run-stage.js';
import { modelFor } from './model-for.js';

describe('modelFor', () => {
  it('should return opus when the run uses aisf:create-bug-ticket', () => {
    expect(modelFor({ stage: 'create', skill: 'aisf:create-bug-ticket' })).toBe('opus');
  });

  it('should return the stage model when the run uses aisf:create-ticket', () => {
    expect(modelFor({ stage: 'create', skill: 'aisf:create-ticket' })).toBe(stageModels.create);
  });

  it.each<RunStage>(['create', 'implement', 'plan'])(
    'should return the stage model when a %s run has no skill',
    (stage) => {
      expect(modelFor({ stage })).toBe(stageModels[stage]);
    },
  );

  it('should return the implement model when the run uses aisf:implement-bug-ticket', () => {
    expect(modelFor({ stage: 'implement', skill: 'aisf:implement-bug-ticket' })).toBe('sonnet');
  });
});
