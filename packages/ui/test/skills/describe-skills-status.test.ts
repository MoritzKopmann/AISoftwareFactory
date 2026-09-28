import { describe, expect, it } from 'vitest';
import { describeSkillsStatus } from '../../src/skills/describe-skills-status.js';

describe('describeSkillsStatus', () => {
  it('should describe no banner when the state is passed', () => {
    expect(describeSkillsStatus({ state: 'passed' })).toBeUndefined();
  });

  it('should describe a danger banner with the reason as detail when the state is failed', () => {
    expect(describeSkillsStatus({ state: 'failed', reason: 'claude exited with code 1' })).toEqual({
      tone: 'danger',
      message: 'Runs are blocked.',
      detail: 'claude exited with code 1',
      pulses: false,
    });
  });

  it('should describe a pulsing info banner when the state is pending', () => {
    expect(describeSkillsStatus({ state: 'pending' })).toEqual({
      tone: 'info',
      message: 'Checking the skills. Runs start once the smoke test passes.',
      pulses: true,
    });
  });
});
