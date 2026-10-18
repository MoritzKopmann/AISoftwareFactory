import { describe, expect, it } from 'vitest';
import { describeDescriptionSwap, settleDescriptionOpen } from './describe-description-swap.js';

describe('describeDescriptionSwap', () => {
  it('should show the description and no toggle when no round is up', () => {
    const swap = describeDescriptionSwap(false, false);

    expect(swap).toEqual({ toggle: { kind: 'hidden' }, panel: 'description' });
  });

  it('should show the round and a Show description toggle when a round is up and the toggle is closed', () => {
    const swap = describeDescriptionSwap(true, false);

    expect(swap).toEqual({
      toggle: { kind: 'shown', label: 'Show description', expanded: false },
      panel: 'round',
    });
  });

  it('should show the description and a Hide description toggle when a round is up and the toggle is open', () => {
    const swap = describeDescriptionSwap(true, true);

    expect(swap).toEqual({
      toggle: { kind: 'shown', label: 'Hide description', expanded: true },
      panel: 'description',
    });
  });

  it('should show the description and no toggle when the round ends while the toggle is open', () => {
    const swap = describeDescriptionSwap(false, true);

    expect(swap).toEqual({ toggle: { kind: 'hidden' }, panel: 'description' });
  });
});

describe('settleDescriptionOpen', () => {
  it('should keep the toggle open when a round is up', () => {
    expect(settleDescriptionOpen(true, true)).toBe(true);
  });

  it('should close the toggle when the round ends, so a new round starts closed', () => {
    expect(settleDescriptionOpen(true, false)).toBe(false);
  });

  it('should keep the toggle closed when a round is up', () => {
    expect(settleDescriptionOpen(false, true)).toBe(false);
  });
});
