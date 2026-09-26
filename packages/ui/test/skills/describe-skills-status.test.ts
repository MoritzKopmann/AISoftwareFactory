import { describe, expect, it } from 'vitest';
import { describeSkillsStatus } from '../../src/skills/describe-skills-status.js';

describe('describeSkillsStatus', () => {
  it('should report the smoke test as passed and runs as allowed when the state is passed', () => {
    expect(describeSkillsStatus({ state: 'passed' })).toEqual({
      headline: 'Skills smoke test passed',
      blocked: false,
    });
  });

  it('should report runs as blocked with the reason when the state is failed', () => {
    expect(describeSkillsStatus({ state: 'failed', reason: 'claude exited with code 1' })).toEqual({
      headline: 'Runs are blocked',
      detail: 'claude exited with code 1',
      blocked: true,
    });
  });

  it('should report the checks as running when the state is pending', () => {
    expect(describeSkillsStatus({ state: 'pending' })).toEqual({
      headline: 'Skills smoke test is running',
      blocked: true,
    });
  });
});
