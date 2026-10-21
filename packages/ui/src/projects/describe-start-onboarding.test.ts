import { describe, expect, it } from 'vitest';
import { describeStartOnboarding } from './describe-start-onboarding.js';

describe('describeStartOnboarding', () => {
  it('should be busy when starting', () => {
    expect(describeStartOnboarding({ kind: 'starting' }).isBusy).toBe(true);
  });

  it('should show a warn error telling to reload when onboarding already exists', () => {
    expect(describeStartOnboarding({ kind: 'conflict' })).toEqual({
      isBusy: false,
      error: {
        tone: 'warn',
        message: 'Onboarding already started or done. Reload the page to see it.',
      },
    });
  });

  it('should show a danger error with the server message as detail when the start failed', () => {
    expect(
      describeStartOnboarding({ kind: 'failed', message: 'Project o/n is not registered' }).error,
    ).toEqual({
      tone: 'danger',
      message: "Couldn't start onboarding.",
      detail: 'Project o/n is not registered',
    });
  });

  it('should show no detail when the start failed and the server gave no message', () => {
    expect(describeStartOnboarding({ kind: 'failed', message: '' }).error).toEqual({
      tone: 'danger',
      message: "Couldn't start onboarding.",
    });
  });

  it('should show a danger error asking to try again when aisf is unreachable', () => {
    expect(describeStartOnboarding({ kind: 'unreachable' }).error).toEqual({
      tone: 'danger',
      message: "Can't reach aisf. Press Start onboarding to try again.",
    });
  });

  it('should show no error when idle', () => {
    expect(describeStartOnboarding({ kind: 'idle' })).toEqual({ isBusy: false });
  });
});
