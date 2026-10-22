import { describe, expect, it } from 'vitest';
import { describeSessionToggle } from './describe-session-toggle.js';

describe('describeSessionToggle', () => {
  it('should offer Hide session as expanded when the session is shown', () => {
    const toggle = describeSessionToggle(true);

    expect(toggle).toEqual({ label: 'Hide session', expanded: true });
  });

  it('should offer Show session as collapsed when the session is hidden', () => {
    const toggle = describeSessionToggle(false);

    expect(toggle).toEqual({ label: 'Show session', expanded: false });
  });
});
