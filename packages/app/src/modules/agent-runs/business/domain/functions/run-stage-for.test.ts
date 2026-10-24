import { describe, expect, it } from 'vitest';
import { runStageFor } from './run-stage-for.js';

describe('runStageFor', () => {
  it('should return design when an idea ticket has the ui type', () => {
    expect(runStageFor({ status: 'idea', types: ['ui'] })).toBe('design');
  });

  it('should return create when an idea ticket has no type', () => {
    expect(runStageFor({ status: 'idea', types: [] })).toBe('create');
  });

  it('should return onboard when a ready ticket has the onboard type', () => {
    expect(runStageFor({ status: 'ready', types: ['onboard'] })).toBe('onboard');
  });

  it('should return create when an idea ticket has the onboard type', () => {
    expect(runStageFor({ status: 'idea', types: ['onboard'] })).toBe('create');
  });

  it('should return plan when a plan ticket has the onboard type', () => {
    expect(runStageFor({ status: 'plan', types: ['onboard'] })).toBe('plan');
  });

  it('should return spike when a ready ticket has the spike type', () => {
    expect(runStageFor({ status: 'ready', types: ['spike'] })).toBe('spike');
  });

  it('should return implement when a ready ticket has no special type', () => {
    expect(runStageFor({ status: 'ready', types: ['bug'] })).toBe('implement');
  });
});
