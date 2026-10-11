import { describe, expect, it } from 'vitest';
import { deriveSecondaryStates } from '../../../src/shared/ticket-status/derive-secondary-states.js';

describe('deriveSecondaryStates', () => {
  it('should be false for both when no flag label is present', () => {
    expect(deriveSecondaryStates({ labelNames: ['status: in-progress', 'hitl'] })).toEqual({
      waiting: false,
      stuck: false,
    });
  });

  it('should set waiting when the waiting label is present', () => {
    expect(deriveSecondaryStates({ labelNames: ['status: in-progress', 'waiting'] })).toEqual({
      waiting: true,
      stuck: false,
    });
  });

  it('should set stuck when the stuck label is present', () => {
    expect(deriveSecondaryStates({ labelNames: ['stuck'] })).toEqual({
      waiting: false,
      stuck: true,
    });
  });

  it('should ignore the legacy status labels when the flags are derived', () => {
    expect(deriveSecondaryStates({ labelNames: ['status: waiting', 'status: stuck'] })).toEqual({
      waiting: false,
      stuck: false,
    });
  });
});
